import { Stack, StackProps, Fn } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CfnRoute } from 'aws-cdk-lib/aws-ec2';

interface VpcPeeringRoutesStackProps extends StackProps {
  peeringConnectionId: string;
  vpcCidrA: string;
  routeTableIdA: string;
  vpcCidrB: string;
  routeTableIdB: string;
}

export class VpcPeeringRoutesStack extends Stack {
  constructor(scope: Construct, id: string, props: VpcPeeringRoutesStackProps) {
    super(scope, id, props);

    // Route from VPC A to VPC B
    new CfnRoute(this, 'RouteVpcAToVpcB', {
      routeTableId: props.routeTableIdA,
      destinationCidrBlock: props.vpcCidrB,
      vpcPeeringConnectionId: props.peeringConnectionId,
    });

    // Route from VPC B to VPC A
    new CfnRoute(this, 'RouteVpcBToVpcA', {
      routeTableId: props.routeTableIdB,
      destinationCidrBlock: props.vpcCidrA,
      vpcPeeringConnectionId: props.peeringConnectionId,
    });
  }
}
