import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CfnVPCPeeringConnection } from 'aws-cdk-lib/aws-ec2';

interface VpcPeeringStackProps extends StackProps {
  vpcIdA: string;
  vpcIdB: string;
  regionB: string;
}

export class VpcPeeringStack extends Stack {
  public peeringConnectionId: string;

  constructor(scope: Construct, id: string, props: VpcPeeringStackProps) {
    super(scope, id, props);

    const vpcPeering = new CfnVPCPeeringConnection(this, 'VpcPeeringConnection', {
      vpcId: props.vpcIdA,
      peerVpcId: props.vpcIdB,
      peerRegion: props.regionB,
    });

    this.peeringConnectionId = vpcPeering.attrId
  }
}
