#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { BasicVPCStack } from '../lib/BasicVPCStack';
import { BasicEC2Stack } from '../lib/BasicEC2Stack';
import { BasicASGStack } from '../lib/BasicASGStack';
import { BasicLambdaStack } from '../lib/BasicLambdaStack';

const app = new cdk.App({});
const env = {
  // Pulled from Environment Variables
  account: process.env.AWS_ACCOUNT_ID,
  region: process.env.AWS_REGION,
};

const vpcStack = new BasicVPCStack(app, 'BasicVPCStack', { 
  stackName: 'BasicVPCStack', 
  env 
});
const vpcStack2 = new BasicVPCStack(app, 'BasicVPCStack-useast1', { 
  stackName: 'BasicVPCStack-useast1', 
  env: {
    ...env,
    region: 'us-east-1'
  }
});

// Stack to test lambda function, creates EC2 boxes in different region
new BasicEC2Stack(app, 'BasicEC2Stack-useast1', {
  env: { 
    ...env,
    region: 'us-east-1'
  },
  stackName: 'BasicEC2Stack',
  securityGroup: vpcStack2.givenSecurityGroup,
  vpc: vpcStack2.vpc,
  publicSubnet: vpcStack2.publicSubnet,
  bucket: vpcStack2.bucket
});

new BasicASGStack(app, 'BasicASGStack', {
  env,
  stackName: 'BasicASGStack',
  securityGroup: vpcStack.givenSecurityGroup,
  vpc: vpcStack.vpc,
  publicSubnet: vpcStack.publicSubnet,
  bucket: vpcStack.bucket,
});

new BasicLambdaStack(app, 'BasicLambdaStack', {
  env,
  stackName: 'BasicLambdaStack',
  // securityGroup: vpcStack.givenSecurityGroup,
  // vpc: vpcStack.vpc,
  // publicSubnet: vpcStack.publicSubnet,
  // bucket: vpcStack.bucket,
});