import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigwv2 from '@aws-cdk/aws-apigatewayv2-alpha';
import { HttpJwtAuthorizer } from '@aws-cdk/aws-apigatewayv2-authorizers-alpha';
import { HttpLambdaIntegration } from '@aws-cdk/aws-apigatewayv2-integrations-alpha';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';

import { Construct } from 'constructs';
import * as path from 'path';
import { execSync } from 'child_process';
import { DynamoEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import * as dotenv from 'dotenv';

// Load environment variables from the frontend app for CDK deploy-time configuration
dotenv.config({ path: path.join(__dirname, '../../frontend/.env.local') });

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

    // Add GSI for efficient querying of runs by user and sorting by date (Refactor: PR Feedback)
    runsTable.addGlobalSecondaryIndex({
      indexName: 'byUserIdAndCreatedAt',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
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
          assetHash:
            cdk.FileSystem.fingerprint(path.join(__dirname, '../../backend/go')) + '-' + cmdDir, // Force CDK to rebuild when Go code changes
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
      RUNS_GSI_NAME: 'byUserIdAndCreatedAt',
    });

    const getRunFunction = buildGoLambda('GetRunFunction', 'getrun', {
      RUNS_TABLE_NAME: runsTable.tableName,
    });

    const getLeadsFunction = buildGoLambda('GetLeadsFunction', 'getleads', {
      LEADS_TABLE_NAME: leadsTable.tableName,
      LEADS_GSI_NAME: 'runId-index',
      RUNS_TABLE_NAME: runsTable.tableName,
    });

    runsTable.grantWriteData(createRunFunction);
    runsTable.grantReadData(getRunsFunction);
    runsTable.grantReadData(getRunFunction);
    runsTable.grantReadData(getLeadsFunction);
    leadsTable.grantReadData(getLeadsFunction);

    const processRunFunction = new lambda.Function(this, 'ProcessRunFunction', {
      runtime: lambda.Runtime.PYTHON_3_12,
      architecture: lambda.Architecture.ARM_64,
      handler: 'process_run.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/python'), {
        bundling: {
          image: lambda.Runtime.PYTHON_3_12.bundlingImage,
          command: [
            'bash',
            '-c',
            'pip install -r requirements.txt -t /asset-output --platform manylinux2014_aarch64 --only-binary=:all: && cp -R src/handlers/* /asset-output/',
          ],
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
    // API Gateway (HTTP API v2)
    // -------------------------------------------------------

    const api = new apigwv2.HttpApi(this, 'OutpostHttpApi', {
      apiName: 'Outpost API',
      corsPreflight: {
        allowHeaders: ['Content-Type', 'Authorization'],
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.OPTIONS,
        ],
        allowOrigins: ['*'],
      },
    });

    // Note: In production, you would fetch this from SSM.
    // The issuer must exactly match your Clerk Frontend API URL.
    const issuerUrl = process.env.CLERK_ISSUER_URL;
    if (!issuerUrl) {
      throw new Error('CLERK_ISSUER_URL environment variable is not set. Cannot synthesize stack.');
    }

    const clerkAuthorizer = new HttpJwtAuthorizer('ClerkAuthorizer', issuerUrl, {
      // By default, Clerk sets the audience to your frontend URL or a specific string.
      jwtAudience: [process.env.CLERK_JWT_AUDIENCE || 'outpost-api'],
    });

    api.addRoutes({
      path: '/runs',
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration('CreateRunIntegration', createRunFunction),
      authorizer: clerkAuthorizer,
    });

    api.addRoutes({
      path: '/runs',
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration('GetRunsIntegration', getRunsFunction),
      authorizer: clerkAuthorizer,
    });

    api.addRoutes({
      path: '/runs/{id}',
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration('GetRunIntegration', getRunFunction),
      authorizer: clerkAuthorizer,
    });

    api.addRoutes({
      path: '/runs/{id}/leads',
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration('GetLeadsIntegration', getLeadsFunction),
      authorizer: clerkAuthorizer,
    });

    // -------------------------------------------------------
    // Outputs
    // -------------------------------------------------------

    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: api.url!,
      description: 'Outpost API endpoint URL',
    });
  }
}
