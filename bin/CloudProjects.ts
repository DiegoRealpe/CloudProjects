#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { BasicVPCStack } from '../lib/BasicVPCStack';
import { BasicEC2Stack } from '../lib/BasicEC2Stack';
import { BasicASGStack } from '../lib/BasicASGStack';

const app = new cdk.App({});
const env = {
  // Pulled from Environment Variables
  account: process.env.AWS_ACCOUNT_ID,
  region: process.env.AWS_REGION,
};

const vpcStack = new BasicVPCStack(app, 'BasicVPCStack', { stackName: 'BasicVPCStack', env });

const ec2Stack = new BasicEC2Stack(app, 'BasicEC2Stack', {
  env,
  stackName: 'BasicEC2Stack',
  securityGroup: vpcStack.givenSecurityGroup,
  vpc: vpcStack.vpc,
  publicSubnet: vpcStack.publicSubnet,
  bucket: vpcStack.bucket
});

const asgStaack = new BasicASGStack(app, 'BasicASGStack', {
  env,
  stackName: 'BasicASGStack',
  securityGroup: vpcStack.givenSecurityGroup,
  vpc: vpcStack.vpc,
  publicSubnet: vpcStack.publicSubnet,
  bucket: vpcStack.bucket,
});
