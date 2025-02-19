import { CfnResource, IResolvable, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
// import { ComponentConfig } from "./interface/componentConfig";
// import { Distribution } from "./interface/distribution";
import path = require("path");
import { ServicePrincipal } from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as iam from "aws-cdk-lib/aws-iam";
import * as kms from "aws-cdk-lib/aws-kms";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as imagebuilder from "aws-cdk-lib/aws-imagebuilder";
import * as cdk from "aws-cdk-lib";
import { BucketDeployment, Source } from "aws-cdk-lib/aws-s3-deployment";
import * as ec2 from "aws-cdk-lib/aws-ec2";
// import { Infrastructure } from "./interface/infrastructureConfig"
// import { Recipe } from "./interface/recipeConfig";
// import { MainConfig } from "./interface/mainConfig";
// import { Tags } from "./interface/tagInterfaces";
import { S3 } from "aws-cdk-lib/aws-ses-actions";

export class ImagebuilderPipeline extends Construct {
  private bucket: s3.IBucket;
  private ec2InstanceProfile: iam.InstanceProfile;

  private createInstanceProfileRole(): iam.InstanceProfile {
    const givenEC2RoleName =
      this.node.tryGetContext("givenEC2RoleName") ?? "default-ec2-role-name";
    const ec2ServiceRole = new iam.Role(this, `${givenEC2RoleName}-role`, {
      roleName: givenEC2RoleName,
      description: "Service role to run an EC2 simple java server",
      assumedBy: new ServicePrincipal("ec2.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "AmazonSSMManagedInstanceCore"
        ),
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "EC2InstanceProfileForImageBuilder"
        ),
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonInspectorFullAccess"),
      ],
      inlinePolicies: {
        ec2BasicPermissions: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: ["ec2:CreateTags"],
              resources: [
                `arn:aws:ec2:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:*/*`,
              ],
            }),
            new iam.PolicyStatement({
              actions: [
                "s3:Get*",
                "s3:Delete*",
                "s3:Create*",
                "s3:Update*",
                "s3:List*",
                "s3:Put*",
              ],
              resources: [
                `arn:aws:s3:::${this.bucket.bucketName}`,
                `arn:aws:s3:::${this.bucket.bucketName}/*`,
              ],
            }),
          ],
        }),
      },
    });

    return new iam.InstanceProfile(this, `${givenEC2RoleName}-ip`, {
      instanceProfileName: givenEC2RoleName,
      role: ec2ServiceRole,
    });
  }

  private createS3Bucket(): s3.Bucket {
    const givenBucketName = this.node.tryGetContext("givenBucketName");
    const shouldCreateBucket =
      this.node.tryGetContext("shouldCreateBucket") ?? true;
    let assignedBucket: s3.Bucket;

    if (shouldCreateBucket) {
      assignedBucket = new s3.Bucket(this, "amibucket-cpre599", {
        versioned: this.node.tryGetContext("amiComponentBucketVersion"),
        bucketName: givenBucketName?.bucketName,
        encryption: cdk.aws_s3.BucketEncryption.S3_MANAGED,
      });
      assignedBucket.addToResourcePolicy(
        new iam.PolicyStatement({
          actions: ["s3:Get*", "s3:Put*", "s3:List*"],
          resources: [
            `arn:aws:s3:::${assignedBucket.bucketName}`,
            `arn:aws:s3:::${assignedBucket.bucketName}/*`,
          ],
          principals: [new iam.AccountRootPrincipal()],
        })
      );
    } else {
      if (!givenBucketName) {
        throw new Error("No Bucket Name Given");
      }
      console.log("Bucket exists");
      assignedBucket = s3.Bucket.fromBucketName(
        this,
        "amibucket-cpre599",
        givenBucketName.bucketName
      ) as s3.Bucket;
    }
    return assignedBucket;
  }

  // private createKMSKey(): kms.Key {
  //     return new kms.Key(this, "ec2AmiEncryptionKey", {
  //         enableKeyRotation: true,
  //         policy: new iam.PolicyDocument({statements: [
  //             // Default Statement 1: Allow Root User Full Access
  //             new iam.PolicyStatement({
  //             effect: iam.Effect.ALLOW,
  //             principals: [new iam.AccountRootPrincipal()], // Root User
  //             actions: ['kms:*'],
  //             resources: ['*'],
  //             }),
  //             // Default Statement 2: Allow CloudTrail Access
  //             new iam.PolicyStatement({
  //             effect: iam.Effect.ALLOW,
  //             principals: [new iam.ServicePrincipal('cloudtrail.amazonaws.com')],
  //             actions: ['kms:GenerateDataKey*', 'kms:Decrypt'],
  //             resources: ['*'],
  //             conditions: {
  //                 'StringLike': {
  //                 'kms:EncryptionContext:aws:cloudtrail:arn': 'arn:aws:cloudtrail:*:123456789012:trail/*'
  //                 }
  //             }
  //             }),
  //             new iam.PolicyStatement({
  //                 actions: [
  //                     "kms:Decrypt",
  //                     "kms:Encrypt",
  //                     "kms:Generate*",
  //                     "kms:ReEncrypt*",
  //                     "kms:CreateGrant",
  //                     "kms:DescribeKey",
  //                 ],
  //                 principals: [new iam.AccountRootPrincipal()],
  //                 conditions: {
  //                     StringLike: {
  //                     "aws:PrincipalArn": `arn:aws:iam::${cdk.Aws.ACCOUNT_ID}:role/aws-service-role/imagebuilder.amazonaws.com/AWSServiceRoleForImageBuilder`,
  //                     },
  //                 },
  //                 resources: ["*"],
  //             }),
  //             new iam.PolicyStatement({
  //                 actions: [
  //                 "kms:Decrypt",
  //                 "kms:Encrypt",
  //                 "kms:Generate*",
  //                 "kms:ReEncrypt*",
  //                 "kms:CreateGrant",
  //                 "kms:DescribeKey",
  //                 ],
  //                 principals: [new iam.AccountPrincipal(cdk.Aws.ACCOUNT_ID)],
  //                 conditions: {
  //                 StringLike: {
  //                     "aws:PrincipalArn": `arn:aws:iam::${cdk.Aws.ACCOUNT_ID}:role/EC2ImageBuilderDistributionCrossAccountRole`,
  //                 },
  //                 },
  //                 resources: ["*"],
  //             })
  //         ]
  //         }
  //     })
  // }

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.bucket = this.createS3Bucket();
    this.ec2InstanceProfile = this.createInstanceProfileRole();

    const attribute = this.node.tryGetContext("attribute") ?? "demo";
    const baseArn = this.node.tryGetContext("baseImage").getImage(this).imageId;

    // This is Dropping whatever "components" are
    // TODO cleanup?
    // const s3componentdeploy = new BucketDeployment(this, "DeployComponents", {
    //     sources: [sourceAsset],
    //     destinationBucket: this.bucket,
    //     destinationKeyPrefix: this.node.tryGetContext('componentsPrefix')
    // });

    // const sourceAsset = Source.asset(this.node.tryGetContext('componentsPrefix'));
    // let defaultComponent = this.node.tryGetContext('defaultComponentConfig');
    // if (defaultComponent) {
    //     this.addComponent(defaultComponent, this.bucket.bucketName, "Build", s3componentdeploy);
    // }
    // this.addComponent(this.node.tryGetContext("componentConfig"), this.bucket.bucketName, "Build", s3componentdeploy);
    // this.addComponent(this.node.tryGetContext("componentConfig"), this.bucket.bucketName, "Test", s3componentdeploy);
    // if (defaultComponent) {
    //     this.addComponent(defaultComponent, this.bucket.bucketName, "Test", s3componentdeploy);
    // }

    // this.componentBuild.forEach((value) => {
    //     if (this.node.tryGetContext('resourceRemovalPolicy') === "destroy") {
    //     value.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);
    //     } else {
    //     value.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);
    //     }
    // });

    // let distArn = undefined;
    // if (this.node.tryGetContext('amitag')) { this.amitag = this.node.tryGetContext('amitag'); }
    // if (this.node.tryGetContext('tag')) { this.tag = this.node.tryGetContext('tag'); }

    // if (this.node.tryGetContext("distributionConfig")) {
    //     this.distribution = this.node.tryGetContext("distributionConfig");
    //     let distributionName = this.node.tryGetContext('distributionName') ?? `golden-ami-distribution-${attribute}`;
    //     let distributionDesc = this.node.tryGetContext('distributionDescription') ?? `Distribution settings for ${attribute}`;
    //     this.dist = this.createDistribution(this.distribution, this.amitag, this.tag, distributionName, distributionDesc);
    //     distArn = this.dist.attrArn;
    // }

    const keyAlias = this.node.tryGetContext("keyAlias");
    let keyid;

    // if (this.node.tryGetContext('iamEncryption')) {
    //     this.cmk = this.createKMSKey(this.distribution, keyAlias);
    //     keyid = this.cmk.keyId;
    // }

    // this.recipe = this.buildRecipe(
    //     baseArn,
    //     keyid,
    //     this.componentList,
    //     attribute
    // );

    // this.infra = this.createInfra(
    //     this.instanceProfileRole,
    //     attribute
    // );
    // this.infra.addDependsOn(this.instanceProfileRole);

    // const imagePipelineName = this.node.tryGetContext('imagePipelineName') ?? `golden-ami-pipeline-${attribute}`;

    // this.pipeline = this.createImagePipeline(
    //     this.recipe,
    //     distArn,
    //     this.infra.attrArn,
    //     imagePipelineName,
    //     this.node.tryGetContext('schedule')
    // );
    // this.pipeline.addDependsOn(this.infra);
  }

  private createInfra(
    instanceprofile: iam.CfnInstanceProfile,
    attribute: string
  ): imagebuilder.CfnInfrastructureConfiguration {
    const infrastructure = this.node.tryGetContext("infrastructure") ?? {};

    try {
      return new imagebuilder.CfnInfrastructureConfiguration(
        this,
        "Golden_AMI_Instance_Infra",
        {
          name: infrastructure.name ?? `golden-ami-infra-${attribute}`,
          instanceTypes: infrastructure.instanceType?.map((it: any) =>
            it.toString()
          ),
          instanceProfileName: instanceprofile.instanceProfileName!,
          subnetId: infrastructure.subnetId?.subnetId,
          securityGroupIds: infrastructure.securityGroups?.map((sg: any) =>
            sg.securityGroupId?.toString()
          ),
          snsTopicArn: this.node.tryGetContext("snsTopic")?.topicArn,
        }
      );
    } catch (error) {
      console.error("Error creating infra config", error);
      throw new Error("Error creating infra config");
    }
  }
}
