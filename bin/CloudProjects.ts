#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { VPCStack } from '../lib/VPCStack';
import { ImageBuilderStack } from '../lib/ImageBuilderStack';

const app = new cdk.App({});
const env = {
  // Pulled from Environment Variables
  account: process.env.AWS_ACCOUNT_ID,
  region: process.env.AWS_REGION,
};

const vpcStack = new VPCStack(app, 'VPCStack', { stackName: 'VPCStack', env });

const ibStack = new ImageBuilderStack(app, 'ImageBuilderStack', {
  env,
  stackName: 'ImageBuilderStack',
  snsTopicArn: vpcStack.ec2ImageBuildTopic.topicArn,
  publicSubnetID: vpcStack.publicSubnet.subnetId,
  securityGroupID: vpcStack.givenSecurityGroup.securityGroupId,
});
