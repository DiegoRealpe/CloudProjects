import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Construct } from 'constructs';

export interface ASGStackProps extends cdk.StackProps {
  securityGroup: ec2.ISecurityGroup;
  vpc: ec2.IVpc;
  publicSubnet: ec2.ISubnet;
  bucket: s3.IBucket;
}

export class BasicASGStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ASGStackProps) {
    super(scope, id, props);

    const key = ec2.KeyPair.fromKeyPairName(this, 'givenKey', 'ec2_login_key');

    const nlb = new elbv2.NetworkLoadBalancer(this, 'BasicNLB', {
      vpc: props.vpc,
      internetFacing: true,
    });
    
    // Create a Listener on Port 1000
    const listener = nlb.addListener('TCPListener', {
      port: 10008,
      protocol: elbv2.Protocol.TCP
    });

    // Create a Launch Template
    const launchTemplate = new ec2.LaunchTemplate(this, 'BasicLaunchTemplate', {
      // Template created manually
      machineImage: ec2.MachineImage.genericLinux({
        [`${this.region}`]: 'ami-0cf098e44ab62d604',
      }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      keyPair: key,
      securityGroup: props.securityGroup,
    });
    const asg = new autoscaling.AutoScalingGroup(this, 'BasicAutoScalingGroup', {
      vpc: props.vpc,
      launchTemplate: launchTemplate,
      minCapacity: 2,
      // desiredCapacity: 2,
      maxCapacity: 3,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
    });
    const networkTargetGroup = new elbv2.NetworkTargetGroup(this, 'BasicTargetGroup', {
      vpc: props.vpc,
      port: 10008,
      protocol: elbv2.Protocol.TCP,
      targets: [asg], 
      healthCheck: {
        protocol: elbv2.Protocol.TCP, 
        port: 'traffic-port',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
      },
    });
    listener.addTargetGroups('AddTargetGroup', networkTargetGroup);

    new cdk.CfnOutput(this, 'NLBAddress', {
      value: `http://${nlb.loadBalancerDnsName}`,
      description: 'NLB public DNS',
    });

    // Output the Auto Scaling Group Name
    new cdk.CfnOutput(this, 'ASGName', {
      value: asg.autoScalingGroupName,
      description: 'The Auto Scaling Group name',
    });
  }
}
