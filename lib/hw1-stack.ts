import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3Deployment from 'aws-cdk-lib/aws-s3-deployment';
import path = require('path');

export class Hw1Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    /* Parameter Section */

    // These are parameters that can be defined in cdk.json
    // If they are not defined, defaults are used
    const bucketNameParam = this.node.tryGetContext('bucketNameParam')
    const filePathParam = this.node.tryGetContext('filePathParam')
    const keyNameParam = this.node.tryGetContext('keyNameParam')
    const instanceTypeParam = this.node.tryGetContext('instanceTypeParam')
    const imageIDParam = this.node.tryGetContext('imageIDParam')
    const securityGroupIDParam = this.node.tryGetContext('securityGroupIDParam')
    // Extracts file name from path context param
    const filePath = path.resolve(filePathParam)
    const directoryName = path.dirname(filePath)
    const fileName = path.basename(filePath)

    // Fetches key pair from name via passed context param
    const givenKey = ec2.KeyPair.fromKeyPairName(this, 'givenKey', keyNameParam)
    // Turn instance type string into a cdk.aws_ec2.InstanceType object
    const givenInstanceType = new ec2.InstanceType(instanceTypeParam)

    /* EC2 Section */

    // Using default VPC
    const vpc = ec2.Vpc.fromLookup(this, 'defaultVPC', {
      isDefault: true,
    })

    // Creating a public subnet
    const publicSubnet = new ec2.PublicSubnet(this, 'SimplePublicSubnet', {
      vpcId: vpc.vpcId,
      //Using the entire VPC CIDR for the subnet
      cidrBlock: vpc.vpcCidrBlock,
      //Places the subnet in the first returned AZ
      availabilityZone: this.availabilityZones[0],
      mapPublicIpOnLaunch: true,
    });
    
    // If given imageID is invalid, use latest image
    let givenMachineImage: ec2.IMachineImage;
    try {
      givenMachineImage = ec2.MachineImage.genericLinux({
        [`${this.region}`]: `${imageIDParam}`
      })
    } catch (error) {
      givenMachineImage = ec2.MachineImage.latestAmazonLinux2()
    }

    // Get Security Group from passed ID or use create one if not found
    let givenSecurityGroup: ec2.ISecurityGroup;
    try {
      givenSecurityGroup = ec2.SecurityGroup.fromSecurityGroupId(this, 'givenSecurityGroup', securityGroupIDParam)
    } catch (error) {
      givenSecurityGroup = new ec2.SecurityGroup(
        this,
        'sshSecurityGroup',
        { 
          vpc: vpc, 
          allowAllOutbound: true,
          description: 'SSH Security Group'
        },
      );
      givenSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22));
    }
    // Creates an EC2 instance according to parameters passed
    new ec2.Instance(this, "TestInstance", {
      instanceType: givenInstanceType,
      machineImage: givenMachineImage,
      keyPair: givenKey,
      securityGroup: givenSecurityGroup,
      vpc: vpc,
      vpcSubnets: { subnets: [publicSubnet] },
    });


    /* S3 section */

    const bucket = new s3.Bucket(this, 'StaticWebBucket', {
      bucketName: bucketNameParam,
      websiteIndexDocument: fileName,
      //Allows public read access to files if ACLs allow it 
      publicReadAccess: true,
      //Enforces Access Control Lists instead of blocking all access
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS, 
      //When bucket is destroyed, this guarantees objects in it are also deleted
      autoDeleteObjects: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    
    // I am using a CDK construct known as a "BucketDeployment" to upload a file to S3
    // In the background, this construct creates a Lambda function 
    // Function waits for the S3 bucket to be created and then uploads files and sets permissions 
    new s3Deployment.BucketDeployment(this, 'DeployWebsite', {
      sources: [
        s3Deployment.Source.asset(directoryName, {
          readers: [new iam.AnyPrincipal()],
          exclude: ['**', `!${fileName}`]
        })
      ],
      destinationBucket: bucket,
    });

    new cdk.CfnOutput(this, 'WebsiteURL', {
      value: bucket.bucketWebsiteUrl, 
      description: 'URL of the static website',
    });

  }
}
