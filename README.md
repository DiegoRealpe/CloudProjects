# Diego's CprE 559 Cloud Projects Repository

Hello! If you are reading this you are probably a Teaching Assistant and I have written this guide to walk you though how to run this program written using the AWS Cloud Development Kit in Typescript.

<details>
  <summary><b>Why not just use the AWS Java SDK like the other students?</b></summary>

Writing code to create AWS resources in the SDK can be very tedious as you have to manually read and specify all the configuration options to use for each resource. If there are failures in the configuration of resources, the program may stop in the middle of deployment and you are forced to rely on the web console to roll back.

In contrast, the CDK library uses _Cloudformation_ in the background. When a CDK app is ran with the command `cdk deploy`, it outputs a template that tells AWS exactly how to create the cloud resources and if there are config errors, it will tell you at compilation time instead of mid deployment and in case of failures in deployment, changes can easily be rolled back running `cdk destroy`

</details>

## Installation

Since I have not heard back from either of the TAs and I do not know about your execution environment. I am including the installation steps from scratch for both Windows and Linux.

### Node.js

<details>
  <summary>Node.js Installation Instructions for Windows</summary>

1. Open **PowerShell** as Administrator
2. Install the Windows Package Manager **Chocolatey** by running

   ```powershell
   Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
   ```

3. Install Node.js Long Term Support version using Chocolatey

   ```powershell
   choco install nodejs-lts
   ```

</details>

<details>
  <summary>Node.js Installation Instructions for Linux</summary>

1. Update apt and install curl

   ```bash
   sudo apt update && sudo apt upgrade && sudo apt install curl -y
   ```

2. Install NodeSource PPA

   ```bash
   curl -sL https://deb.nodesource.com/setup_lts.x -o /tmp/nodesource_setup.sh
   ```

3. Install Node.js

   ```bash
   sudo apt install nodejs
   ```

</details>

### Typescript and CDK

Now that Node.js is installed, add the packages for TS and CDK globally with npm

```bash
npm install -g typescript
npm install -g aws-cdk
```

## Configure AWS Credentials

Since I was not able to talk to the TAs, I was not sure how you guys have your credentials set up. CDK can use both a creds file at `~/.aws/credentials` but I prefer setting creds using environment variables. Please set these variables in your shell environment.

```bash
export AWS_ACCESS_KEY_ID="********************"
export AWS_SECRET_ACCESS_KEY="****************************************"
export AWS_ACCOUNT_ID="************"
export AWS_REGION="us-east-2"
```

## Run "Cloud Projects" CDK App

Once CDK is installed, clone the repo and cd into it.

> **Important:** before running the commands below you have to "bootstrap" your AWS account by running `cdk bootstrap`. Bootstrapping CDK will create an S3 bucket to store Cloudformation metadata (which keeps track of the state of resources)

- To build the program use `npm run build`
- To deploy the specified resources, you can run `cdk deploy --require-approval never`
- To destroy the resources, run `cdk destroy -f`

### Run app with your own custom parameters

Often tools like SDK or the CLI will take in parameters using hardcoded string variables inside the code which are then used for the AWS API calls. For example, as part of the requirements of the first assignment, we are asked to pass:

- SSH keys
- Security group ID
- AMI ID
- EC2 instance type
- S3 bucket name
- File path to upload to it.

(Region is passed through the environment variable we set earlier along with the credentials)

In this CDK project, these parameters are extracted from the "CDK context". This is a section inside the `cdk.json` file of this project containing key-value pairs. If you open the `cdk.json` file and replace my default fields for your own, the app will use these when provisioning resources

## Project Description

1. Deploys an S3 bucket with public read permissions, set up for static web hosting
2. Creates an EC2 instance using the specified AMI, instance type, security group and key pair name
3. Deploys and S3 bucket and uploads a file to it

In this project I combined parts 1 & 3 so when the program is ran, it accepts a parameter for the path to a website HTML file. It then creates a bucket with static webhosting enabled, uploads the file and servers it as a static website.

## Troubleshooting Permissions

I am running this project using an IAM role with Admin priviledges so the deployment had no problems creating all these resources though cloudformation. However, if you are not using a role/user with admin priviledges, these are the permissions you are going to need to run my project:

<details>
  <summary>IAM Least Permissions for CDK</summary>

```json
{
	"Version": "2012-10-17",
	"Statement": [
		{
			"Effect": "Allow",
			"Action": "sts:AssumeRole",
			"Resource": [
				"arn:aws:iam::844062109895:role/cdk-*-file-publishing-role-*",
				"arn:aws:iam::844062109895:role/cdk-*-lookup-role-*",
				"arn:aws:iam::844062109895:role/cdk-*-deploy-role-*"
			]
		},
		{
			"Effect": "Allow",
			"Action": [
				"cloudformation:CreateChangeSet",
				"cloudformation:DeleteChangeSet",
				"cloudformation:DeleteStack",
				"cloudformation:DescribeChangeSet",
				"cloudformation:DescribeStackEvents",
				"cloudformation:DescribeStacks",
				"cloudformation:ExecuteChangeSet",
				"cloudformation:GetTemplate"
			],
			"Resource": "arn:aws:cloudformation:*:*:stack/CDKToolkit/*"
		},
		{
			"Effect": "Allow",
			"Action": [
				"iam:CreateRole",
				"iam:DeleteRole",
				"iam:GetRole",
				"iam:GetRolePolicy",
				"iam:AttachRolePolicy",
				"iam:DetachRolePolicy",
				"iam:DeleteRolePolicy",
				"iam:PutRolePolicy",
				"iam:TagRole"
			],
			"Resource": ["arn:aws:iam::*:policy/*", "arn:aws:iam::*:role/cdk-*"]
		},
		{
			"Effect": "Allow",
			"Action": [
				"s3:CreateBucket",
				"s3:DeleteBucket",
				"s3:PutBucketPolicy",
				"s3:DeleteBucketPolicy",
				"s3:PutBucketPublicAccessBlock",
				"s3:PutBucketVersioning",
				"s3:PutEncryptionConfiguration",
				"s3:PutLifecycleConfiguration"
			],
			"Resource": ["arn:aws:s3:::cdk-*"]
		},
		{
			"Effect": "Allow",
			"Action": [
				"ssm:DeleteParameter",
				"ssm:GetParameter",
				"ssm:GetParameters",
				"ssm:PutParameter"
			],
			"Resource": ["arn:aws:ssm:*:*:parameter/cdk-bootstrap/*"]
		},
		{
			"Effect": "Allow",
			"Action": [
				"ecr:CreateRepository",
				"ecr:DeleteRepository",
				"ecr:DescribeRepositories",
				"ecr:SetRepositoryPolicy",
				"ecr:PutLifecyclePolicy"
			],
			"Resource": ["arn:aws:ecr:*:*:repository/cdk-*"]
		}
	]
}
```

</details>
