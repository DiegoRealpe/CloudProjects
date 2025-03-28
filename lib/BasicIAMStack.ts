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
  public role: iam.IRole;

  constructor(scope: cdk.App, id: string, props: BasicIAMStackProps) {
    super(scope, id, props);

    /* S3 Section */
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

    // 2. Create policy P with provided name
    const basicAccessPolicy = new iam.ManagedPolicy(this, 'basicAccessPolicy', {
      managedPolicyName: props.basicAccessPolicyName,
      description: 'Policy with S3 and EC2 permissions',
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['s3:ListAllMyBuckets'],
          resources: ['*'],
        }),
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['s3:ListBucket', 's3:GetObject', 's3:PutObject', 's3:DeleteObject'],
          resources: [this.bucket.bucketArn, `${this.bucket.bucketArn}/*`],
        }),
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['ec2:*'],
          resources: ['*'],
        }),
      ],
    });
    
    // 6. Create role with provided name
    const roleR = new iam.Role(this, 'DevAccessRole', {
        roleName: props.roleName,
        assumedBy: new iam.AccountPrincipal(this.account),
        managedPolicies: [basicAccessPolicy],
      });

    // 7. Create policy Q that allows assuming role R
    const assumeAsPolicy = new iam.ManagedPolicy(this, 'assumeAsPolicy', {
      managedPolicyName: 'assumeAsPolicy',
      description: 'Policy that allows assuming this.role',
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['sts:AssumeRole'],
          resources: [this.role.roleArn],
        }),
      ],
    });

    // 3. Create IAM group with provided name
    const groupA = new iam.Group(this, 'GroupA', {
      groupName: props.groupAName,
      managedPolicies: [basicAccessPolicy],
    });
    // 7. Create group with provided name
    const groupB = new iam.Group(this, 'GroupB', {
      groupName: props.groupBName,
      managedPolicies: [assumeAsPolicy],
    });

    // 4. Create IAM user with provided name
    const userA = new iam.User(this, 'UserA', {
      userName: props.userAName,
      groups: [groupA],
    });
    // 8. Create user with provided name
    const userB = new iam.User(this, 'UserB', {
      userName: props.userBName,
      groups: [groupB],
    });

    // Outputs for easy reference
    new cdk.CfnOutput(this, 'bucketName', {
      value: this.bucket.bucketName,
    });
    new cdk.CfnOutput(this, 'UserAName', {
      value: userA.userName,
    });
    new cdk.CfnOutput(this, 'UserBName', {
      value: userB.userName,
    });
    new cdk.CfnOutput(this, 'this.roleArn', {
      value: this.role.roleArn,
    });
  }
}
