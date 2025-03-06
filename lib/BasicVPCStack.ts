import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as s3 from 'aws-cdk-lib/aws-s3';
// import * as s3Deployment from 'aws-cdk-lib/aws-s3-deployment';
import * as iam from 'aws-cdk-lib/aws-iam';
import path = require('path');

export class BasicVPCStack extends cdk.Stack {
  public givenSecurityGroup: ec2.ISecurityGroup;
  public vpc: ec2.IVpc;
  public publicSubnet: ec2.ISubnet;
  public bucket: s3.IBucket;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    /* S3 Section */
    const givenBucketName = (this.node.tryGetContext('givenBucketName') as string) + '-' + props?.env?.region;
    const shouldCreateBucket = this.node.tryGetContext('shouldCreateBucket') ?? true;

    if (shouldCreateBucket) {
      this.bucket = new s3.Bucket(this, givenBucketName, {
        versioned: false,
        bucketName: givenBucketName,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        autoDeleteObjects: true,
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS,
        encryption: cdk.aws_s3.BucketEncryption.S3_MANAGED,
      });
      this.bucket.addToResourcePolicy(
        new iam.PolicyStatement({
          actions: ['s3:Get*', 's3:Put*', 's3:List*'],
          resources: [`arn:aws:s3:::${this.bucket.bucketName}`, `arn:aws:s3:::${this.bucket.bucketName}/*`],
          principals: [
            new iam.AccountRootPrincipal(),
            new iam.ServicePrincipal('ec2.amazonaws.com'),
          ],
        }),
      );
    } else {
      if (!givenBucketName) {
        throw new Error('No Bucket Name Given');
      }
      console.log('Bucket exists');
      this.bucket = s3.Bucket.fromBucketName(this, 'gpbucket-cpre599', givenBucketName) as s3.Bucket;
    }

    // this.bucketDeploy = new s3Deploy.BucketDeployment(this, 'DeployWebsite', {
    // 	sources: [
    // 		s3Deploy.Source.asset('./assets/', {
    // 			readers: [new iam.AnyPrincipal()],
    // 			exclude: ['**', `!ssm.yaml`],
    // 		}),
    // 	],
    // 	destinationBucket: this.bucket,
    // });

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
      }],
    });

    // Get Security Group from passed ID or use create one if not found
    this.givenSecurityGroup = new ec2.SecurityGroup(this, 'javaServerSecGroup', {
      description: 'SSH, SSM Security Group',
      vpc: this.vpc,
      allowAllOutbound: true,
    });
    this.givenSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22));
    this.givenSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443));
    this.givenSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(10008));
    
    // Export public subnet
    this.publicSubnet = this.vpc.publicSubnets[0];
  }

}
