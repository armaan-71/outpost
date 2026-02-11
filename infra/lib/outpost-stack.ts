import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';

export class OutpostStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Resources will be defined here:
    // - DynamoDB tables (Runs, Leads)
    // - Lambda functions (via NodejsFunction + esbuild)
    // - API Gateway
    // - Step Functions state machine
    // - S3 buckets
  }
}
