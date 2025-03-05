cd /home/ec2-user

yum update -y
yum install -y nc git amazon-cloudwatch-agent java-17-amazon-corretto-devel amazon-ssm-agent

systemctl enable amazon-ssm-agent
systemctl start amazon-ssm-agent
/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -s -c ssm:us-east-2:AmazonCloudWatch-linux
systemctl enable amazon-cloudwatch-agent
systemctl restart amazon-cloudwatch-agent


java -version
echo "Setup Complete"
