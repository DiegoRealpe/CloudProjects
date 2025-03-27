import { Stack, StackProps, Fn } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CfnRoute } from 'aws-cdk-lib/aws-ec2';

interface VpcPeeringRoutesStackProps extends StackProps {
  peeringConnectionId: string;
  sourceVpcCidr: string;
  destinationVpcCidr: string;
  sourceRouteTableId: string;
}


export class VpcPeeringRoutesStack extends Stack {
  constructor(scope: Construct, id: string, props: VpcPeeringRoutesStackProps) {
    super(scope, id, props);

    new CfnRoute(this, 'VpcPeeringRoute', {
        routeTableId: props.sourceRouteTableId,
        destinationCidrBlock: props.destinationVpcCidr,
        vpcPeeringConnectionId: props.peeringConnectionId,
      });
  }
}
