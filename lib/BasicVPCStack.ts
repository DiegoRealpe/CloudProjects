import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as s3 from 'aws-cdk-lib/aws-s3';
// import * as s3Deployment from 'aws-cdk-lib/aws-s3-deployment';
import * as iam from 'aws-cdk-lib/aws-iam';
import path = require('path');

export class BasicVPCStack extends cdk.Stack {
  public givenSecurityGroup: ec2.ISecurityGroup;
  public vpc: ec2.Vpc;
  public publicSubnet: ec2.ISubnet;
  public privateSubnet: ec2.ISubnet;

  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    /* EC2 Section */
    let cidrBasicVPC: string 
    if(props?.env?.region == 'us-east-1'){
      cidrBasicVPC = '13.0.0.0/16';
    }else {
      cidrBasicVPC = '12.0.0.0/16';
    }
    
    this.vpc = new ec2.Vpc(this, `BasicVPC-${props?.env?.region}`, {
      ipAddresses: ec2.IpAddresses.cidr(cidrBasicVPC),
      maxAzs: 2, // Only 1 AZ
      createInternetGateway: true,
      subnetConfiguration: [{
        name: 'BasicPubSubnet',
        subnetType: ec2.SubnetType.PUBLIC, // Defines it as a public subnet
        cidrMask: 24,
        mapPublicIpOnLaunch: true
      }
      // ,{
      //   name: 'BasicPrivSubnet',
      //   subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, // Defines it as a private subnet
      //   cidrMask: 24,
      // }
      ],
    });

    // Get Security Group from passed ID or use create one if not found
    this.givenSecurityGroup = new ec2.SecurityGroup(this, `javaServerSecGroup-${props?.env?.region}`, {
      description: 'SSH, SSM Security Group',
      vpc: this.vpc,
      allowAllOutbound: true,
    });
    this.givenSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22));
    this.givenSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443));
    this.givenSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(10008));
    
    // Export subnets
    this.publicSubnet = this.vpc.publicSubnets[0];
    // this.privateSubnet = this.vpc.privateSubnets[0];
  }

}
