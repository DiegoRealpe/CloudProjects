import { Construct } from 'constructs';
import { getFileString } from './utils';
import path = require('path');
import { ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as cdk from 'aws-cdk-lib';

export interface EC2StackProps extends cdk.StackProps {
  securityGroup: ec2.ISecurityGroup;
  vpc: ec2.IVpc;
  publicSubnet: ec2.ISubnet;
  privateSubnet: ec2.ISubnet;
  bucket: s3.IBucket;
}

export class BasicEC2Stack extends cdk.Stack {
  public givenMachineImage: ec2.IMachineImage;
  public ec2InstanceProfile: iam.InstanceProfile;
  public ec2EncryptionKey: kms.Key;
  public ec2ServiceRole: iam.Role;
  public givenKey: ec2.IKeyPair;

  constructor(scope: Construct, id: string, props: EC2StackProps) {
    super(scope, id, props);

    /* Parameter Section */
    this.givenKey = ec2.KeyPair.fromKeyPairName(this, 'givenKey', 'ec2_login_key');
    this.ec2EncryptionKey = this.createKMSKey();
    this.ec2InstanceProfile = this.createInstanceProfileRole();
    // const givenBaseImage = this.node.tryGetContext('givenBaseImage') 
    //   ?? 'ami-0e7b3e7766d24a6ff'; // Amaxon Linux 2 Image Default
    // this.givenMachineImage = ec2.MachineImage.genericLinux({
    //   [`${}`]: `${givenBaseImage}`,
    // });
    this.givenMachineImage = ec2.MachineImage.latestAmazonLinux2()

    // Creating a Cloudwatch config file in SSM
    new ssm.StringParameter(this, 'CloudWatchAgentConfig', {
      parameterName: '/AmazonCloudWatch-linux',
      stringValue: getFileString('./assets/cwa-config.json'),
      description: 'CloudWatch Agent Configuration for EC2 instances',
      tier: ssm.ParameterTier.STANDARD
    });
    
    const cloudInit = ec2.CloudFormationInit.fromConfigSets({
      configSets: {
        default: ["install"],
      },
      configs: {
        install: new ec2.InitConfig([
          // Copy source files
          ec2.InitCommand.shellCommand(
            "echo 'export BUCKET_NAME=\"" + props.bucket.bucketName + "\"' >> /home/ec2-user/.bashrc"
          ),
          // Copy setup file
          ec2.InitFile.fromFileInline(
            '/etc/ec2_setup_script.sh',
            './assets/ec2_setup_script.sh',
            { mode: '000755', owner: 'root', group: 'root' }
          ),
          ec2.InitFile.fromFileInline(
            '/home/ec2-user/EchoServer.java',
            './assets/EchoServer.java',
            { mode: '000644', owner: 'ec2-user', group: 'ec2-user' }
          ),
          // Create Systemd Service for Java Server
          ec2.InitFile.fromFileInline(
            '/etc/systemd/system/echo-server.service',
            './assets/echo-server.service',
            { mode: '000644', owner: 'root', group: 'root' }
          ),
          // Run Setup
          ec2.InitCommand.shellCommand('/etc/ec2_setup_script.sh'),
          // Compile Java server
          ec2.InitCommand.shellCommand('cd /home/ec2-user && javac EchoServer.java'),
          // Enable & Start the service
          ec2.InitCommand.shellCommand('systemctl daemon-reload'),
          ec2.InitCommand.shellCommand('systemctl enable echo-server'),
          ec2.InitCommand.shellCommand('systemctl start echo-server'),
        ]),
      },
    })

    new ec2.Instance(this, 'Test--PublicInstance-A', {
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      machineImage: this.givenMachineImage,
      vpc: props.vpc,
      keyPair: this.givenKey,
      vpcSubnets: { subnets: [props.publicSubnet] },
      securityGroup: props.securityGroup,
      instanceProfile: this.ec2InstanceProfile,
      init: cloudInit,
      initOptions: {
        timeout: cdk.Duration.minutes(15),
      },
    });
    new ec2.Instance(this, 'Test-PrivateInstance-B', {
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      machineImage: this.givenMachineImage,
      vpc: props.vpc,
      keyPair: this.givenKey,
      vpcSubnets: { subnets: [props.privateSubnet] },
      securityGroup: props.securityGroup,
      instanceProfile: this.ec2InstanceProfile,
      init: cloudInit,
      initOptions: {
        timeout: cdk.Duration.minutes(15),
      },
    });
  }

  private createInstanceProfileRole(): iam.InstanceProfile {
    const givenBucketName = this.node.tryGetContext('givenBucketName');
    this.ec2ServiceRole = new iam.Role(this, 'default-java-ec2-role', {
      description: 'Service role to run an EC2 simple java server',
      assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonInspectorFullAccess'),
      ],
      inlinePolicies: {
        ec2BasicPermissions: new iam.PolicyDocument({
          statements: [
            // May not be needed
            new iam.PolicyStatement({
              actions: ['ec2:CreateTags'],
              resources: [`arn:aws:ec2:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:*/*`],
            }),
            new iam.PolicyStatement({
              actions: ['s3:Get*', 's3:Delete*', 's3:Create*', 's3:Update*', 's3:List*', 's3:Put*'],
              resources: [`arn:aws:s3:::${givenBucketName}`, `arn:aws:s3:::${givenBucketName}/*`],
            }),
            new iam.PolicyStatement({
              actions: [
                'ssm:GetParameter',
                'ssm:DescribeParameters'
              ],
              resources: [`arn:aws:ssm:${cdk.Aws.REGION}:*:parameter/AmazonCloudWatch-linux`],
            })
          ],
        }),
      },
    });

    return new iam.InstanceProfile(this, 'default-java-ec2-ip', {
      role: this.ec2ServiceRole,
    });
  }

  private createKMSKey(): kms.Key {
    return new kms.Key(this, 'ec2AmiEncryptionKey', {
      enableKeyRotation: true,
      policy: new iam.PolicyDocument({
        statements: [
          // Default Statement 1: Allow Root User Full Access
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            principals: [new iam.AccountRootPrincipal()], // Root User
            actions: ['kms:*'],
            resources: ['*'],
          }),
          // Default Statement 2: Allow CloudTrail Access
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            principals: [new iam.ServicePrincipal('cloudtrail.amazonaws.com')],
            actions: ['kms:GenerateDataKey*', 'kms:Decrypt'],
            resources: ['*'],
            conditions: {
              StringLike: {
                'kms:EncryptionContext:aws:cloudtrail:arn': `arn:aws:cloudtrail:*:${cdk.Aws.ACCOUNT_ID}:trail/*`,
              },
            },
          }),
        ],
      }),
    });
  }
}
