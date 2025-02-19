import { Construct } from 'constructs';
import * as fs from 'fs';
import path = require('path');
import { ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3Deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as imagebuilder from 'aws-cdk-lib/aws-imagebuilder';
import * as cdk from 'aws-cdk-lib';

export interface ImageBuilderStackProps extends cdk.StackProps {
  snsTopicArn: string,
  publicSubnetID: string
  securityGroupID: string
}

export class ImageBuilderStack extends cdk.Stack {
	public props: ImageBuilderStackProps
	public bucket: s3.IBucket;
	// public bucketDeploy: s3Deploy.BucketDeployment;
	public ec2InstanceProfile: iam.InstanceProfile;
	public ec2EncryptionKey: kms.Key;
	public imagePipeline: imagebuilder.CfnImagePipeline;
	public imageRecipe: imagebuilder.CfnImageRecipe;
	public infraConfig: imagebuilder.CfnInfrastructureConfiguration;
	public componentList: imagebuilder.CfnImageRecipe.ComponentConfigurationProperty;
	public distributionConfig: imagebuilder.CfnDistributionConfiguration;

	constructor(scope: Construct, id: string, props: ImageBuilderStackProps) {
		super(scope, id, props);
		this.props = props

		const shouldUseAMIEncryption = (this.node.tryGetContext('shouldUseAMIEncryption') as boolean) ?? true;
		this.ec2InstanceProfile = this.createInstanceProfileRole();
		this.bucket = this.createS3Bucket();
		this.bucket.node.addDependency(this.ec2InstanceProfile)
		if (shouldUseAMIEncryption) {
			this.ec2EncryptionKey = this.createKMSKey();
		}
		this.distributionConfig = this.createDistribution();
		this.imageRecipe = this.buildRecipe();
		this.infraConfig = this.createInfra();
		this.imagePipeline = this.createImagePipeline();
		// this.pipeline.addDependsOn(this.infra);
	}

	private createInstanceProfileRole(): iam.InstanceProfile {
		const givenEC2RoleName = this.node.tryGetContext('givenEC2RoleName') ?? 'default-java-ec2';
		const givenBucketName = this.node.tryGetContext('givenBucketName')
		const ec2ServiceRole = new iam.Role(this, `${givenEC2RoleName}-role`, {
			roleName: givenEC2RoleName,
			description: 'Service role to run an EC2 simple java server',
			assumedBy: new ServicePrincipal('ec2.amazonaws.com'),
			managedPolicies: [
				iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
				iam.ManagedPolicy.fromAwsManagedPolicyName('EC2InstanceProfileForImageBuilder'),
				iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2ContainerRegistryReadOnly'),
				iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonInspectorFullAccess'),
			],
			inlinePolicies: {
				ec2BasicPermissions: new iam.PolicyDocument({
					statements: [
						new iam.PolicyStatement({
							actions: ['ec2:CreateTags'],
							resources: [`arn:aws:ec2:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:*/*`],
						}),
						new iam.PolicyStatement({
							actions: ['s3:Get*', 's3:Delete*', 's3:Create*', 's3:Update*', 's3:List*', 's3:Put*'],
							resources: [`arn:aws:s3:::${givenBucketName}`, `arn:aws:s3:::${givenBucketName}/*`],
						}),
					],
				}),
			},
		});

		return new iam.InstanceProfile(this, `${givenEC2RoleName}-ip`, {
			instanceProfileName: `${givenEC2RoleName}-ip`,
			role: ec2ServiceRole,
		});
	}

	private createS3Bucket(): s3.Bucket {
		const givenBucketName = this.node.tryGetContext('givenBucketName');
		const shouldCreateBucket = this.node.tryGetContext('shouldCreateBucket') ?? true;
		let assignedBucket: s3.Bucket;

		if (shouldCreateBucket) {
			assignedBucket = new s3.Bucket(this, 'amibucket-cpre599', {
				versioned: false,
				bucketName: givenBucketName?.bucketName,
				encryption: cdk.aws_s3.BucketEncryption.S3_MANAGED,
			});
			assignedBucket.addToResourcePolicy(
				new iam.PolicyStatement({
					actions: ['s3:Get*', 's3:Put*', 's3:List*'],
					resources: [
						`arn:aws:s3:::${assignedBucket.bucketName}`, 
						`arn:aws:s3:::${assignedBucket.bucketName}/*`
					],
					principals: [
						new iam.AccountRootPrincipal(), 
						new iam.ServicePrincipal('ec2.amazonaws.com'), 
						new iam.ServicePrincipal('imagebuilder.amazonaws.com'),
						// new iam.ArnPrincipal(this.ec2InstanceProfile.role?.roleArn!)
					],
				}),
			);
		} else {
			if (!givenBucketName) {
				throw new Error('No Bucket Name Given');
			}
			console.log('Bucket exists');
			assignedBucket = s3.Bucket.fromBucketName(this, 'amibucket-cpre599', givenBucketName.bucketName) as s3.Bucket;
		}

		// this.bucketDeploy = new s3Deploy.BucketDeployment(this, 'DeployWebsite', {
		// 	sources: [
		// 		s3Deploy.Source.asset('./assets/', {
		// 			readers: [new iam.AnyPrincipal()],
		// 			exclude: ['**', `!ssm.yaml`],
		// 		}),
		// 	],
		// 	destinationBucket: assignedBucket,
		// });

		return assignedBucket;
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
								'kms:EncryptionContext:aws:cloudtrail:arn': 'arn:aws:cloudtrail:*:123456789012:trail/*',
							},
						},
					}),
					new iam.PolicyStatement({
						actions: ['kms:Decrypt', 'kms:Encrypt', 'kms:Generate*', 'kms:ReEncrypt*', 'kms:CreateGrant', 'kms:DescribeKey'],
						principals: [new iam.AccountRootPrincipal()],
						conditions: {
							StringLike: {
								'aws:PrincipalArn': `arn:aws:iam::${cdk.Aws.ACCOUNT_ID}:role/aws-service-role/imagebuilder.amazonaws.com/AWSServiceRoleForImageBuilder`,
							},
						},
						resources: ['*'],
					}),
					new iam.PolicyStatement({
						actions: ['kms:Decrypt', 'kms:Encrypt', 'kms:Generate*', 'kms:ReEncrypt*', 'kms:CreateGrant', 'kms:DescribeKey'],
						principals: [new iam.AccountPrincipal(cdk.Aws.ACCOUNT_ID)],
						conditions: {
							StringLike: {
								'aws:PrincipalArn': `arn:aws:iam::${cdk.Aws.ACCOUNT_ID}:role/EC2ImageBuilderDistributionCrossAccountRole`,
							},
						},
						resources: ['*'],
					}),
				],
			}),
		});
	}

	private createImagePipeline(): imagebuilder.CfnImagePipeline {
		const givenImagePipelineName = this.node.tryGetContext('givenImagePipelineName') ?? `ec2ImagePipeline`;
		try {
			const pipeline = new imagebuilder.CfnImagePipeline(this, 'ec2ImagePipeline', {
				name: givenImagePipelineName,
				imageRecipeArn: this.imageRecipe.attrArn,
				infrastructureConfigurationArn: this.infraConfig.attrArn,
				distributionConfigurationArn: this.distributionConfig.attrArn,
				enhancedImageMetadataEnabled: true,
			});
			return pipeline;
		} catch (error) {
			throw new Error('Error creating pipeline');
		}
	}

	private createInfra(): imagebuilder.CfnInfrastructureConfiguration {
		const givenInfraConfigName = this.node.tryGetContext('givenInfraConfigName') ?? 'defaultInfraConfigName';
		const givenInstanceType = this.node.tryGetContext('givenInstanceType') ?? 't2.micro';

		try {
			return new imagebuilder.CfnInfrastructureConfiguration(this, 'infraConfig', {
				name: givenInfraConfigName,
				instanceTypes: [givenInstanceType],
				instanceProfileName: this.ec2InstanceProfile.instanceProfileName,
				subnetId: this.props.publicSubnetID,
				securityGroupIds: [this.props.securityGroupID],
				snsTopicArn: this.props.snsTopicArn,
				logging: {
					s3Logs: {
						s3BucketName: this.bucket.bucketName,
						s3KeyPrefix: 'image-builder-logs/'
					}
				}
			});
		} catch (error) {
			console.error('Error creating infra config', error);
			throw new Error('Error creating infra config');
		}
	}

	private createDistribution(): imagebuilder.CfnDistributionConfiguration {
		const givenDistroConfigName = this.node.tryGetContext('givenDistroConfigName') ?? `javaLinuxDistroConfig`;
		try {
			let cfnDistributionConfiguration = new imagebuilder.CfnDistributionConfiguration(this, 'javaLinuxDistributionConfiguration', {
				distributions: [
					{
						region: cdk.Aws.REGION,
						amiDistributionConfiguration: {
							name: 'customAMI-{{ imagebuilder:buildDate }}',
							description: 'My distributed AMI',
						},
					},
				],
				name: givenDistroConfigName,
				description: 'Distro configuration to create a Linux Java image',
			});
			return cfnDistributionConfiguration;
		} catch (error) {
			throw new Error('Error creating pipeline');
		}
	}

	private getFileString(filePath: string): string | undefined {
		try {
			const content = fs.readFileSync(filePath, 'utf-8');
			return content;
		} catch (error) {
			console.error(`Error reading file "${filePath}":`, error);
			return undefined;
		}
	}

	private buildRecipe(): imagebuilder.CfnImageRecipe {
		const givenBaseImage = this.node.tryGetContext('givenBaseImage') ?? `arn:aws:imagebuilder:us-east-2:aws:image/amazon-linux-2023-x86/x.x.x`;
		const givenImageRecipeName = this.node.tryGetContext('givenImageRecipeName') ?? `javaImageRecipe`;
		const shouldDeleteOnTermination = this.node.tryGetContext('shouldDeleteOnTermination') === 'true' ? true : false;
		const shouldUseAMIEncryption = this.node.tryGetContext('shouldUseAMIEncryption') === 'true' ? true : false;

		const ssmComponent = new imagebuilder.CfnComponent(this, 'SSMAgentComponent', {
			name: 'InstallSSMAgent',
			platform: 'Linux',
			version: '1.0.0',
			description: 'Installs the AWS Systems Manager Agent (SSM Agent).',
			data: this.getFileString('./assets/ssm.yaml')
		})
		const componentArnList = [
			{
				name: 'amazon-corretto-17-jdk',
				attrArn : `arn:aws:imagebuilder:${cdk.Aws.REGION}:aws:component/amazon-corretto-17-jdk/1.0.0/1`
			},
			ssmComponent
			// {	
			// name: 'yum-repository-test-linux',
			// 	attrArn : `arn:aws:imagebuilder:${cdk.Aws.REGION}:aws:component/yum-repository-test-linux/1.0.1/1`
			// },
		].reduce((arnList: any[], component: any) => {
			arnList.push({ componentArn: component.attrArn });
			return arnList;
		}, []);

		const recipe = new imagebuilder.CfnImageRecipe(this, 'javaImageRecipe', {
			name: givenImageRecipeName,
			version: '1.0.0',
			// Injects image layers here
			components: componentArnList,
			additionalInstanceConfiguration: {
				systemsManagerAgent: {
					uninstallAfterBuild: true
				}
			},
			parentImage: givenBaseImage,
			blockDeviceMappings: [
				{
					deviceName: '/dev/xvda',
					ebs: {
						deleteOnTermination: shouldDeleteOnTermination,
						encrypted: shouldUseAMIEncryption,
						kmsKeyId: shouldUseAMIEncryption ? this.ec2EncryptionKey?.keyId : undefined,
						volumeSize: 20,
						volumeType: 'gp3',
					},
				},
			],
		});

		if (shouldDeleteOnTermination) {
			recipe.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);
		} else {
			recipe.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);
		}
		return recipe;
	}
}
