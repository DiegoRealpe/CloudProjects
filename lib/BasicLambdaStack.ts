import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export class BasicLambdaStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Lambda function to fetch EC2 public IPs
    const ec2PublicIPLambda = new lambda.Function(this, 'EC2PublicIPLambda', {
      runtime: lambda.Runtime.PYTHON_3_9,
      handler: 'index.lambda_handler',
      code: lambda.Code.fromAsset('./lib/lambda/', {
        exclude: ['**', `!index.py`]
      }),
      timeout: cdk.Duration.seconds(10),
      initialPolicy: [
        new cdk.aws_iam.PolicyStatement({
          actions: ['ec2:DescribeInstances'],
          resources: ['*'],
        })
      ]
    });
    const lambdaURL = ec2PublicIPLambda.addFunctionUrl({authType: lambda.FunctionUrlAuthType.NONE})
    ec2PublicIPLambda.addPermission('PublicInvocation', {
      principal: new cdk.aws_iam.AnyPrincipal(),
      action: 'lambda:InvokeFunctionUrl',
      functionUrlAuthType: lambda.FunctionUrlAuthType.NONE,
    })

    // Output API URL
    new cdk.CfnOutput(this, 'Lambda URL', {
      value: lambdaURL.url,
    });
  }
}
