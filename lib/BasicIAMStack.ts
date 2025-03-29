import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';

export interface BasicIAMStackProps extends cdk.StackProps {
  givenBucketName: string;
  groupAName: string;
  groupBName: string;
  userAName: string;
  userBName: string;
  roleName: string;
  assumeAsPolicyName: string;
  basicAccessPolicyName: string;
}

export class BasicIAMStack extends cdk.Stack {
  public bucket: s3.Bucket;
  public role: iam.Role;
  public groupA: iam.CfnGroup;
  public groupB: iam.CfnGroup;
  public userA: iam.User;
  public userB: iam.User;
  private basicAccessPolicyDoc: iam.PolicyDocument;
  private assumeRolePolicyDoc: iam.PolicyDocument;

  constructor(scope: cdk.App, id: string, props: BasicIAMStackProps) {
    super(scope, id, props);

    if (props.givenBucketName) {
      this.bucket = new s3.Bucket(this, props.givenBucketName, {
        versioned: false,
        bucketName: props.givenBucketName,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        autoDeleteObjects: true,
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS,
        encryption: cdk.aws_s3.BucketEncryption.S3_MANAGED,
      });
      this.bucket.addToResourcePolicy(
        new iam.PolicyStatement({
          actions: ['s3:Get*', 's3:Put*', 's3:List*'],
          resources: [`arn:aws:s3:::${this.bucket.bucketName}`, `arn:aws:s3:::${this.bucket.bucketName}/*`],
          principals: [new iam.AccountRootPrincipal(), new iam.ServicePrincipal('ec2.amazonaws.com')],
        }),
      );
    }
    const listS3Policy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['s3:ListAllMyBuckets'],
      resources: ['*'],
    })
    const getS3Policy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['s3:ListBucket', 's3:GetObject', 's3:PutObject', 's3:DeleteObject'],
      resources: [this.bucket.bucketArn, `${this.bucket.bucketArn}/*`],
    })
    const getec2Policy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['ec2:*'],
      resources: ['*'],
    })
    const assumeAsPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['sts:AssumeRole'],
      resources: [`arn:aws:iam::${cdk.Aws.ACCOUNT_ID}:role/${props.roleName}`],
    })
    this.basicAccessPolicyDoc = new iam.PolicyDocument({
      statements: [
        listS3Policy,
        getS3Policy,
        getec2Policy,
      ],
    });
    this.assumeRolePolicyDoc = new iam.PolicyDocument({
      statements: [
        assumeAsPolicy
      ],
    });
    
    this.userB = new iam.User(this, 'UserB', {
      userName: props.userBName,
    });
    this.userA = new iam.User(this, 'UserA', {
      userName: props.userAName,
    });
    
    this.role = new iam.Role(this, 'AccessRole', {
        roleName: props.roleName,
        assumedBy: new iam.CompositePrincipal(
          new iam.AccountPrincipal(this.account),
          new iam.ArnPrincipal(this.userB.userArn)
        ),
        inlinePolicies: {
          'basicAccessPolicy': this.basicAccessPolicyDoc
        }
      });

    this.groupA = new iam.CfnGroup(this, "GroupA", {
      groupName: props.groupAName,
      policies: [{
        policyDocument: this.assumeRolePolicyDoc,
        policyName: "assumeRolePolicy"
      }]
    })
    this.groupB = new iam.CfnGroup(this, "GroupB", {
      groupName: props.groupBName,
      policies: [{
        policyDocument: this.basicAccessPolicyDoc,
        policyName: "basicAccessPolicy"
      }]
    })
    new iam.CfnUserToGroupAddition(this, 'addGroupA', {
      groupName: this.groupA.groupName!,
      users: [this.userA.userName]
    })
    new iam.CfnUserToGroupAddition(this, 'addGroupB', {
      groupName: this.groupB.groupName!,
      users: [this.userB.userName]
    })

    new cdk.CfnOutput(this, 'Bucket Name', {
      value: this.bucket.bucketName,
    });
    new cdk.CfnOutput(this, 'UserA Name', {
      value: this.userA.userName,
    });
    new cdk.CfnOutput(this, 'UserB Name', {
      value: this.userB.userName,
    });
    new cdk.CfnOutput(this, 'Role ARN', {
      value: this.role.roleArn,
    });
  }
}
