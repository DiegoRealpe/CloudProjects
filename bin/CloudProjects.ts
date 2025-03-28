#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { BasicVPCStack } from '../lib/BasicVPCStack';
import { BasicEC2Stack } from '../lib/BasicEC2Stack';
import { BasicIAMStack } from '../lib/BasicIAMStack';
// import { BasicASGStack } from '../lib/BasicASGStack';
// import { BasicLambdaStack } from '../lib/BasicLambdaStack';

const app = new cdk.App();
const env = {
  // Pulled from Environment Variables
  account: process.env.AWS_ACCOUNT_ID,
  region: process.env.AWS_REGION,
};

// Each VPC Stack creates a GP bucket with a provided name or imports one
// Uses VPC high-level construct which sets up RTs, IGW for public and NAT for private
const vpcStack = new BasicVPCStack(app, 'BasicVPCStack', { 
  env,
  stackName: 'BasicVPCStack', 
});

// Creates a Group, Role and 
const iamStack = new BasicIAMStack(app, 'BasicIAMStack', { 
  env,
  stackName: 'BasicIAMStack', 
  givenBucketName: 'gpbucket-coms559',
  groupAName: 'DevGroup',
  groupBName: 'AdminGroup',
  userAName: 'DevUser',
  userBName: 'AdminUser',
  roleName: 'EC2FullAccessRole',
  assumeAsPolicyName: 'AssumeEC2RolePolicy',
  basicAccessPolicyName: '',
});

// Creates EC2 boxes in different region
// Creates 1 Private and 1 Public t3.micro
// Grants EC2 Service Role Access To Bucket
new BasicEC2Stack(app, 'BasicEC2Stack', {
  env,
  stackName: 'BasicEC2Stack',
  securityGroup: vpcStack.givenSecurityGroup,
  vpc: vpcStack.vpc,
  publicSubnet: vpcStack.publicSubnet,
  privateSubnet: vpcStack.privateSubnet,
  givenBucketName: iamStack.bucket.bucketName,
});

// new BasicASGStack(app, 'BasicASGStack', {
//   env,
//   stackName: 'BasicASGStack',
//   securityGroup: vpcStack.givenSecurityGroup,
//   vpc: vpcStack.vpc,
//   publicSubnet: vpcStack.publicSubnet,
//   bucket: vpcStack.bucket,
// });

// new BasicLambdaStack(app, 'BasicLambdaStack', {
//   env,
//   stackName: 'BasicLambdaStack',
// });