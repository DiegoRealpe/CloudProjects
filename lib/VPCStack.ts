import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as iam from 'aws-cdk-lib/aws-iam';
// import * as s3Deployment from 'aws-cdk-lib/aws-s3-deployment';
// import * as s3 from 'aws-cdk-lib/aws-s3';
import path = require('path');
import { getSubnetCidr } from './utils';

export class VPCStack extends cdk.Stack {
  public givenSecurityGroup: ec2.ISecurityGroup;
  public vpc: ec2.IVpc;
  public publicSubnet: ec2.PublicSubnet;
  public givenMachineImage: ec2.IMachineImage;
  public givenKey: ec2.IKeyPair;
  public ec2ImageBuildTopic: sns.Topic;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    /* Parameter Section */

    // These are parameters that can be defined in cdk.json
    // If they are not defined, defaults are used
    const keyNameParam = this.node.tryGetContext('keyNameParam');
    const givenBaseImage = this.node.tryGetContext('givenBaseImage');
    const securityGroupNameParam = this.node.tryGetContext('securityGroupNameParam');

    // Fetches key pair from name via passed context param
    this.givenKey = ec2.KeyPair.fromKeyPairName(this, 'givenKey', keyNameParam);

    /* SNS Section */
    this.ec2ImageBuildTopic = new sns.Topic(this, 'ec2ImageBuildTopic', {
      displayName: 'Image Builder Notifications',
      topicName: 'ec2ImageBuildTopic',
    });
    // Grant AWS Image Builder permissions to publish to this SNS Topic
    this.ec2ImageBuildTopic.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ['sns:Publish'],
        principals: [new iam.ServicePrincipal('imagebuilder.amazonaws.com')],
        resources: [this.ec2ImageBuildTopic.topicArn],
      }),
    );

    /* EC2 Section */
    const cidrSimpleVPC = '10.0.0.0/16';
    this.vpc = new ec2.Vpc(this, 'SimpleVPC', {
      ipAddresses: ec2.IpAddresses.cidr(cidrSimpleVPC),
      maxAzs: 99, // This is how to set MaxAZ as per docs
      subnetConfiguration: [],
    });
    const internetGateway = new ec2.CfnInternetGateway(this, 'InternetGateway', {});
    new ec2.CfnVPCGatewayAttachment(this, 'VPCGatewayAttachment', {
      vpcId: this.vpc.vpcId,
      internetGatewayId: internetGateway.ref,
    });
    const publicRouteTable = new ec2.CfnRouteTable(this, 'SimplePublicRouteTable', {
      vpcId: this.vpc.vpcId,
    });
    new ec2.CfnRoute(this, 'SimplePublicInternetRoute', {
      routeTableId: publicRouteTable.ref,
      destinationCidrBlock: '0.0.0.0/0',
      gatewayId: internetGateway.ref,
    });

    // Creating a public subnet
    const publicCidrBlock = getSubnetCidr(cidrSimpleVPC, 0);
    this.publicSubnet = new ec2.PublicSubnet(this, 'SimplePublicSubnet', {
      vpcId: this.vpc.vpcId,
      //Using the entire VPC CIDR for the subnet
      cidrBlock: publicCidrBlock,
      //Places the subnet in the first returned AZ
      availabilityZone: this.availabilityZones[1],
      mapPublicIpOnLaunch: true,
    });
    new ec2.CfnSubnetRouteTableAssociation(this, 'PublicRouteTableAssociation', {
      subnetId: this.publicSubnet.subnetId,
      routeTableId: publicRouteTable.ref,
    });

    // If given imageID is invalid, use latest image
    try {
      this.givenMachineImage = ec2.MachineImage.genericLinux({
        [`${this.region}`]: `${givenBaseImage}`,
      });
    } catch (error) {
      this.givenMachineImage = ec2.MachineImage.latestAmazonLinux2();
    }

    // Get Security Group from passed ID or use create one if not found

    if (securityGroupNameParam) {
      this.givenSecurityGroup = ec2.SecurityGroup.fromLookupByName(this, 'givenSecurityGroup', securityGroupNameParam, this.vpc);
    } else {
      this.givenSecurityGroup = new ec2.SecurityGroup(this, 'sshSecurityGroup', {
        description: 'SSH, SSM Security Group',
        vpc: this.vpc,
        allowAllOutbound: true,
      });
      this.givenSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22));
      this.givenSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443));
      this.givenSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(10008));
    }

    // Creates an EC2 instance according to parameters passed
    // const bucketNameParam = this.node.tryGetContext('bucketNameParam');
    // const instanceTypeParam = this.node.tryGetContext('instanceTypeParam');
    // const filePathParam = this.node.tryGetContext('filePathParam');
    // Extracts file name from path context param
    // const filePath = path.resolve(filePathParam);
    // const directoryName = path.dirname(filePath);
    // const fileName = path.basename(filePath);

    // Turn instance type string into a cdk.aws_ec2.InstanceType object
    // const givenInstanceType = new ec2.InstanceType(instanceTypeParam);
    // new ec2.Instance(this, 'TestInstance', {
    // 	instanceType: givenInstanceType,
    // 	machineImage: givenMachineImage,
    // 	keyPair: givenKey,
    // 	securityGroup: givenSecurityGroup,
    // 	vpc: vpc,
    // 	vpcSubnets: { subnets: [publicSubnet] },
    // });

    /* S3 section */

    // const bucket = new s3.Bucket(this, 'StaticWebBucket', {
    // 	bucketName: bucketNameParam,
    // 	websiteIndexDocument: fileName,
    // 	//Allows public read access to files if ACLs allow it
    // 	publicReadAccess: true,
    // 	//Enforces Access Control Lists instead of blocking all access
    // 	blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS,
    // 	//When bucket is destroyed, this guarantees objects in it are also deleted
    // 	autoDeleteObjects: true,
    // 	removalPolicy: cdk.RemovalPolicy.DESTROY,
    // });

    // I am using a CDK construct known as a "BucketDeployment" to upload a file to S3
    // In the background, this construct creates a Lambda function
    // Function waits for the S3 bucket to be created and then uploads files and sets permissions
    // new s3Deployment.BucketDeployment(this, 'DeployWebsite', {
    // 	sources: [
    // 		s3Deployment.Source.asset(directoryName, {
    // 			readers: [new iam.AnyPrincipal()],
    // 			exclude: ['**', `!${fileName}`],
    // 		}),
    // 	],
    // 	destinationBucket: bucket,
    // });

    // new cdk.CfnOutput(this, 'WebsiteURL', {
    // 	value: bucket.bucketWebsiteUrl,
    // 	description: 'URL of the static website',
    // });
  }
}
