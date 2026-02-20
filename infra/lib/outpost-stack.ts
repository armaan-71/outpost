import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3'; // Added

import { Construct } from 'constructs';
import * as path from 'path';
import { execSync } from 'child_process';
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

    // Add GSI for efficient sorting by date (Refactor: PR Feedback)
    runsTable.addGlobalSecondaryIndex({
      indexName: 'byEntityTypeAndCreatedAt',
      partitionKey: { name: 'entityType', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
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

    const buildGoLambda = (id: string, cmdDir: string, environment: { [key: string]: string }) => {
      return new lambda.Function(this, id, {
        runtime: lambda.Runtime.PROVIDED_AL2023, // Recommended for Go
        architecture: lambda.Architecture.ARM_64, // Matches your Mac for easier local building
        handler: 'bootstrap', // AL2023 requires the executable to be named 'bootstrap'
        code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/go'), {
          assetHash: cmdDir, // Force CDK to build each binary separately
          bundling: {
            image: lambda.Runtime.PROVIDED_AL2023.bundlingImage,
            local: {
              tryBundle(outputDir: string) {
                try {
                  // Compile the Go binary directly into the output directory as 'bootstrap'
                  execSync(
                    `cd ${path.join(__dirname, '../../backend/go')} && GOOS=linux GOARCH=arm64 go build -tags lambda.norpc -o ${path.join(outputDir, 'bootstrap')} ./cmd/${cmdDir}/main.go`,
                  );
                  return true;
                } catch (e) {
                  console.warn(`Local Go bundling failed for ${id}:`, e);
                  return false;
                }
              },
            },
          },
        }),
        environment,
      });
    };

    const createRunFunction = buildGoLambda('CreateRunFunction', 'createrun', {
      RUNS_TABLE_NAME: runsTable.tableName,
    });

    const getRunsFunction = buildGoLambda('GetRunsFunction', 'getruns', {
      RUNS_TABLE_NAME: runsTable.tableName,
      RUNS_GSI_NAME: 'byEntityTypeAndCreatedAt',
    });

    const getRunFunction = buildGoLambda('GetRunFunction', 'getrun', {
      RUNS_TABLE_NAME: runsTable.tableName,
    });

    const getLeadsFunction = buildGoLambda('GetLeadsFunction', 'getleads', {
      LEADS_TABLE_NAME: leadsTable.tableName,
      LEADS_GSI_NAME: 'runId-index',
    });

    runsTable.grantWriteData(createRunFunction);
    runsTable.grantReadData(getRunsFunction);
    runsTable.grantReadData(getRunFunction);
    leadsTable.grantReadData(getLeadsFunction);

    const processRunFunction = new lambda.Function(this, 'ProcessRunFunction', {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'process_run.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/python/src/handlers'), {
        bundling: {
          image: lambda.Runtime.PYTHON_3_12.bundlingImage,
          local: {
            tryBundle(outputDir: string) {
              try {
                // Install dependencies into the output directory
                execSync(
                  `pip3 install -r ${path.join(__dirname, '../../backend/python/requirements.txt')} -t ${outputDir}`,
                );
                // Copy the handler code into the output directory
                execSync(
                  `cp -R ${path.join(__dirname, '../../backend/python/src/handlers/process_run.py')} ${outputDir}`,
                );
                return true;
              } catch (e) {
                console.warn('Local Python bundling failed:', e);
                return false;
              }
            },
          },
        },
      }),
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
