// This is to be manually invoked when a DDoS incident has gone into a 'resolved' state.
// This will remove DRT access from Shield Advanced as well as the S3 based flow logs.


// ---- do not edit below this line ----
const ShieldClass = function (context, lambdaCallback) {
  const self = this;
  const AWS = require('aws-sdk');
  const http = require('http');

  // Environment variables to be set in hosting Lambda function
  const flowLogsS3 = process.env.flowLogsS3;
  const shieldendpointregion = process.env.shieldendpointregion;

  initialize = function () {
    shieldDisassociateDrt(flowLogsS3);
  };

  shieldDisassociateDrt = function (s3bucket) {
    const params = {
      LogBucket: s3bucket,
    };
    const shield = new AWS.Shield({ region: shieldendpointregion });
    shield.disassociateDRTLogBucket(params, (err, data) => {
      if (err) {
        console.log(err, err.stack); // an error occurred
        throw new Error('Unable to remove DRT from Shield Advanced and S3 based flow logs - please remove them manually');
      } else {
        const params = {};
        shield.disassociateDRTRole(params, (err, data) => {
          if (err) {
            console.log(err, err.stack); // an error occurred
            throw new Error('Unable to remove DRT from Shield Advanced - please remove them manually');
          } 
          else {
            console.log(data); // successful response
          }
        });
      }
    });
  };

  initialize();
};

exports.handler = (event, context, callback) => {
  const shield = new ShieldClass(context, callback);
};
