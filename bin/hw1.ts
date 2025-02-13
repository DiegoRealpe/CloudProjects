#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { Hw1Stack } from '../lib/hw1-stack';

const app = new cdk.App();
new Hw1Stack(app, 'Hw1Stack', {
  env: {
      // Pulled from Environment Variables
      account: process.env.AWS_ACCOUNT_ID, 
      region: process.env.AWS_REGION
    },
});