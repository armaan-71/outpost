#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { OutpostStack } from '../lib/outpost-stack';

const app = new cdk.App();
new OutpostStack(app, 'OutpostStack', {
  // env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
});
