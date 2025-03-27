#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { BasicVPCStack } from '../lib/BasicVPCStack';
import { BasicEC2Stack } from '../lib/BasicEC2Stack';
import { VpcPeeringStack } from '../lib/VpcPeeringStack';
import { VpcPeeringRoutesStack } from '../lib/VpcPeeringRoutesStack';
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
const vpcStack1 = new BasicVPCStack(app, 'BasicVPCStack-useast2', { 
  env,
  stackName: 'BasicVPCStack-useast2', 
  givenBucketName: 'gpbucket-cpre599',
});
const vpcStack2 = new BasicVPCStack(app, 'BasicVPCStack-useast1', { 
  env: {
    ...env,
    region: 'us-east-1'
  },
  stackName: 'BasicVPCStack-useast1',
});

// Creates EC2 boxes in different region
// Creates 1 Private and 1 Public t3.micro
new BasicEC2Stack(app, 'BasicEC2Stack-useast2', {
  env,
  stackName: 'BasicEC2Stack-useast2',
  securityGroup: vpcStack1.givenSecurityGroup,
  vpc: vpcStack1.vpc,
  publicSubnet: vpcStack1.publicSubnet,
  privateSubnet: vpcStack1.privateSubnet,
  bucket: vpcStack1.bucket
});
new BasicEC2Stack(app, 'BasicEC2Stack-useast1', {
  env: { 
    ...env,
    region: 'us-east-1'
  },
  stackName: 'BasicEC2Stack-useast1',
  securityGroup: vpcStack2.givenSecurityGroup,
  vpc: vpcStack2.vpc,
  publicSubnet: vpcStack2.publicSubnet,
  privateSubnet: vpcStack2.privateSubnet,
  bucket: vpcStack1.bucket
});

const peeringStack = new VpcPeeringStack(app, 'PeeringStack', {
  env,
  crossRegionReferences: true,
  vpcIdA: `${vpcStack1.vpc.vpcId}`,
  vpcIdB: `${vpcStack2.vpc.vpcId}`,
  regionB: `${vpcStack2.region}`,
})

const routeStackAtoB = new VpcPeeringRoutesStack(app, 'RouteStackAtoB', {
  env,
  crossRegionReferences: true,
  peeringConnectionId: `${peeringStack.peeringConnectionId}`,
  sourceVpcCidr: `${vpcStack1.vpc.vpcCidrBlock}`,
  destinationVpcCidr: `${vpcStack2.vpc.vpcCidrBlock}`,
  sourceRouteTableId: `${vpcStack1.vpc.privateSubnets[0].routeTable.routeTableId}`,
});

const routeStackBtoA = new VpcPeeringRoutesStack(app, 'RouteStackBtoA', {
  env: { 
    ...env,
    region: 'us-east-1'
  },
  crossRegionReferences: true,
  peeringConnectionId: `${peeringStack.peeringConnectionId}`,
  sourceVpcCidr: `${vpcStack2.vpc.vpcCidrBlock}`,
  destinationVpcCidr: `${vpcStack1.vpc.vpcCidrBlock}`,
  sourceRouteTableId: `${vpcStack2.vpc.privateSubnets[0].routeTable.routeTableId}`
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