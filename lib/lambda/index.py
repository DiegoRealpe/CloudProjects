import json
import boto3 # type: ignore

def lambda_handler(event, context):
    try:
        # Parse input JSON
        body = json.loads(event['body']) if 'body' in event else event
        region = body.get("region")

        if not region:
            return {
                "statusCode": 400,
                "body": json.dumps({"error": "Missing 'region' parameter in request body."})
            }

        # Initialize EC2 client for the specified region
        ec2_client = boto3.client("ec2", region_name=region)

        # Describe EC2 instances and get public IPs of running instances
        response = ec2_client.describe_instances(
            Filters=[{"Name": "instance-state-name", "Values": ["running"]}]
        )

        public_ips = [
            instance["PublicIpAddress"]
            for reservation in response["Reservations"]
            for instance in reservation["Instances"]
            if "PublicIpAddress" in instance
        ]

        return {
            "statusCode": 200,
            "body": json.dumps({"public_ips": public_ips})
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)})
        }
