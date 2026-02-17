import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3'; // Added

import { Construct } from 'constructs';
import * as path from 'path';
import { DynamoEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';

export class OutpostStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // -------------------------------------------------------
    // DynamoDB Tables
    // -------------------------------------------------------

    const runsTable = new dynamodb.Table(this, 'RunsTable', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      stream: dynamodb.StreamViewType.NEW_IMAGE, // Enable Stream for Lambda Trigger
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const leadsTable = new dynamodb.Table(this, 'LeadsTable', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Add GSI for querying leads by runId
    leadsTable.addGlobalSecondaryIndex({
      indexName: 'runId-index',
      partitionKey: { name: 'runId', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    const rawDataBucket = new s3.Bucket(this, 'RawDataBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY, // KEEP DESTROY FOR DEV/PROTOTYPING (Change to RETAIN for Prod)
      autoDeleteObjects: true, // Wipe bucket on stack deletion (Dev only)
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    // -------------------------------------------------------
    // Lambda Functions
    // -------------------------------------------------------

    const createRunFunction = new nodejs.NodejsFunction(this, 'CreateRunFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, '../../backend/src/handlers/createRun.ts'),
      handler: 'handler',
      environment: {
        RUNS_TABLE_NAME: runsTable.tableName,
      },
    });

    const getRunsFunction = new nodejs.NodejsFunction(this, 'GetRunsFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, '../../backend/src/handlers/getRuns.ts'),
      handler: 'handler',
      environment: {
        RUNS_TABLE_NAME: runsTable.tableName,
      },
    });

    const getRunFunction = new nodejs.NodejsFunction(this, 'GetRunFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, '../../backend/src/handlers/getRun.ts'),
      handler: 'handler',
      environment: {
        RUNS_TABLE_NAME: runsTable.tableName,
      },
    });

    const getLeadsFunction = new nodejs.NodejsFunction(this, 'GetLeadsFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, '../../backend/src/handlers/getLeads.ts'),
      handler: 'handler',
      environment: {
        LEADS_TABLE_NAME: leadsTable.tableName,
      },
    });

    runsTable.grantWriteData(createRunFunction);
    runsTable.grantReadData(getRunsFunction);
    runsTable.grantReadData(getRunFunction);
    leadsTable.grantReadData(getLeadsFunction);

    const processRunFunction = new nodejs.NodejsFunction(this, 'ProcessRunFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, '../../backend/src/handlers/processRun.ts'),
      handler: 'handler',
      environment: {
        RUNS_TABLE_NAME: runsTable.tableName,
        LEADS_TABLE_NAME: leadsTable.tableName,
        SERPAPI_KEY_PARAM_NAME: '/outpost/prod/serpapi_key',
        GROQ_API_KEY_PARAM_NAME: '/outpost/prod/groq_api_key',
        GROQ_REQUEST_DELAY_MS: '2000',
        RAW_DATA_BUCKET_NAME: rawDataBucket.bucketName,
      },
      timeout: cdk.Duration.seconds(180), // AI processing takes time
    });

    runsTable.grantReadWriteData(processRunFunction);
    leadsTable.grantWriteData(processRunFunction);
    rawDataBucket.grantPut(processRunFunction);

    // Allow Lambda to read from SSM Parameter Store
    // Grant permission to read the SerpApi and OpenRouter keys from Parameter Store
    // Note: We use a manual policy statement because fromStringParameterName doesn't support SecureString well in CFN templates
    processRunFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ssm:GetParameter'],
        resources: [
          `arn:aws:ssm:${this.region}:${this.account}:parameter/outpost/prod/serpapi_key`,
          `arn:aws:ssm:${this.region}:${this.account}:parameter/outpost/prod/groq_api_key`,
        ],
      }),
    );

    processRunFunction.addEventSource(
      new DynamoEventSource(runsTable, {
        startingPosition: lambda.StartingPosition.LATEST,
      }),
    );

    // -------------------------------------------------------
    // API Gateway
    // -------------------------------------------------------

    const api = new apigateway.RestApi(this, 'OutpostApi', {
      restApiName: 'Outpost API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    const runsResource = api.root.addResource('runs');
    runsResource.addMethod('POST', new apigateway.LambdaIntegration(createRunFunction));
    runsResource.addMethod('GET', new apigateway.LambdaIntegration(getRunsFunction));

    const runResource = runsResource.addResource('{id}');
    runResource.addMethod('GET', new apigateway.LambdaIntegration(getRunFunction));

    const leadsResource = runResource.addResource('leads');
    leadsResource.addMethod('GET', new apigateway.LambdaIntegration(getLeadsFunction));

    // -------------------------------------------------------
    // Outputs
    // -------------------------------------------------------

    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: api.url,
      description: 'Outpost API endpoint URL',
    });
  }
}
