import * as cdk from 'aws-cdk-lib/core';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import * as path from 'path';

export class OutpostStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // -------------------------------------------------------
    // DynamoDB Tables
    // -------------------------------------------------------

    const runsTable = new dynamodb.Table(this, 'RunsTable', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const leadsTable = new dynamodb.Table(this, 'LeadsTable', {
      partitionKey: { name: 'runId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'domain', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // -------------------------------------------------------
    // Lambda Functions
    // -------------------------------------------------------

    const createRunFunction = new NodejsFunction(this, 'CreateRunFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../../backend/src/handlers/createRun.ts'),
      handler: 'handler',
      environment: {
        RUNS_TABLE_NAME: runsTable.tableName,
      },
    });

    runsTable.grantWriteData(createRunFunction);

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

    // -------------------------------------------------------
    // Outputs
    // -------------------------------------------------------

    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: api.url,
      description: 'Outpost API endpoint URL',
    });
  }
}
