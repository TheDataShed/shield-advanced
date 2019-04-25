// Based on https://s3.amazonaws.com/aws-shield-lambda/ShieldEngagementLambda.js
// DRT engagement Lambda docs: https://s3.amazonaws.com/aws-shield-lambda/ShieldEngagementLambda.pdf

// Previous configuration for variables fed into function - now handled by Lambda variables
// ShieldEngagementLambda.js
// Source https://s3.amazonaws.com/aws-shield-lambda/ShieldEngagementLambda.js
// User configurable options
// var config = {
// Change this to "critical" if you are subscribed to Enterprise Support
// severity: 'urgent',

// Change this to 'advanced' if you are subscribed to AWS Shield Advanced
// shield: 'advanced',

// Change this to 'off' after testing
// test: 'on',

// Modify subject and message if not subscribed to AWS Shield Advanced
// Change subject and message to the path of a .txt file that you created in S3
// standardSubject: 'http://s3.amazonaws.com/aws-shield-lambda/EngagementSubject.txt',
// standardMessage: 'http://s3.amazonaws.com/aws-shield-lambda/EngagementBody.txt'
// }

const ShieldClass = function (context, lambdaCallback) {
  const self = this;
  const AWS = require('aws-sdk');
  const http = require('http');
  const retry = require('retry');

  // Environment variables to be set in hosting Lambda function - added by the Data Shed
  const severity = process.env.severity;
  const shield = process.env.shield; //Indicating whether you are a Shield Advanced customer or not
  const test = process.env.test;
  const standardSubject = process.env.standardSubject;
  const standardMessage = process.env.standardMessage;
  const drtRoleArn = process.env.drtRoleArn;
  const flowLogsS3 = process.env.flowLogsS3;
  const shieldendpointregion = process.env.shieldendpointregion;

  initialize = function () {
    self.advancedSubject = 'http://s3.amazonaws.com/aws-shield-lambda/ShieldAdvancedSubject.txt';
    self.advancedMessage = 'http://s3.amazonaws.com/aws-shield-lambda/ShieldAdvancedMessage.txt';
    self.subjectUrl = shield == 'advanced' ? self.advancedSubject : standardSubject;
    self.messageUrl = shield == 'advanced' ? self.advancedMessage : standardMessage;
    self.message = '';
    self.subject = '';
    self.snsParams = {
      Message: '',
      TopicArn: '',
    };
    self.passMessage = 'Unable to complete function execution';
    self.passCount = 0;
    setSNSTopicArn(test);
    s3PullTxt(self.subjectUrl, 'subject');
    s3PullTxt(self.messageUrl, 'message');
    s3PullPromise(0, createCase, sendPage);
    passCheck(0, lambdaCallback);

    // shieldAssociateDrt function reference added by the Data Shed
    shieldAssociateDrt(drtRoleArn);
  };

  setSNSTopicArn = function (test) {
    if (test == 'off') {
      self.snsParams.TopicArn = 'arn:aws:sns:us-east-1:832974201822:DDoSIoTEscalations';
    } else {
      self.snsParams.TopicArn = 'arn:aws:sns:us-east-1:832974201822:DDoSIoTTest';
    }
  };

  s3PullPromise = function (timeout, callback, callbackOfCallback) {
    if (timeout > 10000) { //measured in milliseconds
      console.log('Unable to complete S3 subject/message pull');
      return false;
    }
    if (self.subject == '' || self.message == '') {
      timeout += 20;
      setTimeout(() => {
        s3PullPromise(timeout, callback, callbackOfCallback);
      }, 20);
    } else {
      self.passCount++;
      callback(callbackOfCallback);
    }
  };

  s3PullTxt = function (s3Url, target) {
    http.get(s3Url, (response) => {
      response
        .on('data', (chunk) => {
          self[target] += chunk;
        })
        .on('end', () => {
          if (self[target] == '') {
            self[target] = 'Unable to retrieve text';
          }
        });
    });
  };

  createCase = function (callback) {
    const params = {
      communicationBody: self.message,
      categoryCode: 'inbound-to-aws',
      serviceCode: 'distributed-denial-of-service',
      severityCode: severity,
      subject: self.subject,
    };
    const support = new AWS.Support({
      region: 'us-east-1',
    });
    support.createCase(params, (err, data) => {
      if (err) {
        console.log(err, err.stack);
      } else {
        const params = {
          caseIdList: [
            data.caseId,
          ],
        };
        support.describeCases(params, callback);
      }
    });
  };

  passCheck = function (timeout, callback) {
    if (self.passCount > 2) { //passCount increases by 1 each time s3PullPromise, sendPage and snsPublish functions successfully complete.
      callback(null, self.passMessage); //passCount above 2 indicates that these 3 functions have successfully completed and the other functions can then run through to completion i.e. create the AWS support ticket.
      return;
    }
    if (timeout > 10000) { //measured in milliseconds
      const err = new Error(self.passMessage);
      callback(err);
    } else {
      timeout += 20;
      setTimeout(() => {
        passCheck(timeout, callback);
      }, 20);
    }
  };

  sendPage = function (err, data) {
    self.passCount++;
    if (err) {
      console.log(err, err.stack);
    } else {
      self.snsParams.Message = `\nCase ID ${data.cases[0].displayId
      }\nCustomer ID ${data.cases[0].caseId.split('-')[1]}`;
      snsPublish();
    }
  };

  snsPublish = function () {
    const sns = new AWS.SNS({
      region: self.snsParams.TopicArn.split(':')[3], // Will take the string after the third ':' in the given value but nothing else after the next ':'. This provides us with the region where the SNS topic lives
    });
    sns.publish(self.snsParams, (err, data) => {
      console.log(context);
      if (data == null) {
        self.passMessage = `Failed to publish to SNS${self.snsParams}${err}`;
      } else {
        self.passMessage = 'DDoS Escalation Successful';
        self.passCount++;
      }
    });
  };

  // shieldAssociateDrt function added by the Data Shed
  shieldAssociateDrt = function (drtRole) {
    const params = {
      RoleArn: drtRole,
    };
    const shield = new AWS.Shield({
      region: shieldendpointregion,
      apiVersion: '2016-06-02',
    });
    shield.associateDRTRole(params, (err, data) => { // Grants DRT IAM role for access to Shield Advanced
      if (err) {
        console.log(err, err.stack); // an error occurred
        throw new Error('Unable to grant DRT for access to Shield Advanced');
      } else {
        const s3buckets = [flowLogsS3]; // Creates an array of S3 flow log buckets
        s3buckets.forEach((bucket) => { // Repeat for each defined S3 bucket to grant DRT access to
          const params = {
            LogBucket: bucket,
          };
          const operation = retry.operation();

          operation.attempt((currentAttempt) => {
            shield.associateDRTLogBucket(params, (err, data) => { // Grants DRT access to defined S3 buckets
              if (operation.retry(err == 'OptimisticLockException: Resource has been modified by another client. Please retry')) {
                return; // OptimisticLockException occurs when the SDK client is already in use finishing previous call via associateDRTLogBucket
              } // Retry will deal with this issue of Node.js making 'forEach' processing on an Async basis
              if (err) {
                console.log(err, err.stack); // an error occurred
                throw new Error('Unable to grant DRT for access to S3 based flow logs');
              } else {
                console.log(data); // successful response
              }
            });
          });
        });
      }
    });
  };

  initialize();
};

exports.handler = (event, context, callback) => {
  const shield = new ShieldClass(context, callback);
};
