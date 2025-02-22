import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';
import * as customResources from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';

export class ImageBuilderTriggerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 🔥 Step 1: Define the ARN of the Image Builder pipeline (Replace with your ARN)
    const imagePipelineArn = 'arn:aws:imagebuilder:us-east-1:123456789012:image-pipeline/MyImagePipeline';

    // 🔥 Step 2: IAM Role for Lambda (Allows triggering Image Builder and getting AMI details)
    const lambdaRole = new iam.Role(this, 'LambdaExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')],
    });

    // 🔥 Step 3: Add Inline Policies for Image Builder Actions
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['imagebuilder:StartImagePipelineExecution', 'imagebuilder:GetImage', 'imagebuilder:ListImagePipelineImages'],
        resources: [imagePipelineArn],
      }),
    );

    // 🔥 Step 4: Create the Lambda Function to Trigger Image Builder
    const triggerLambda = new lambda.Function(this, 'TriggerImageBuilderLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'triggerImagePipeline.handler', // Must match the file and function name
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda')), // Load from local directory
      timeout: cdk.Duration.minutes(10), // Allow up to 10 minutes
      role: lambdaRole,
    });

    // 🔥 Step 5: Create Custom Resource to Invoke Lambda During Deployment
    const customResource = new customResources.AwsCustomResource(this, 'TriggerImageBuilderCustomResource', {
      onCreate: {
        service: 'Lambda',
        action: 'invoke',
        parameters: {
          FunctionName: triggerLambda.functionName,
          Payload: JSON.stringify({ ImagePipelineArn: imagePipelineArn }),
        },
        physicalResourceId: customResources.PhysicalResourceId.of('ImageBuilderTrigger'),
      },
      policy: customResources.AwsCustomResourcePolicy.fromSdkCalls({ resources: [triggerLambda.functionArn] }),
    });

    // 🔥 Step 6: Output the AMI ARN
    new cdk.CfnOutput(this, 'AmiArnOutput', {
      value: customResource.getResponseField('Data.AmiArn'),
      description: 'The ARN of the generated AMI',
    });
  }
}
