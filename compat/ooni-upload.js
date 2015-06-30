'use strict';

var moment = require('moment');
var s3 = require('s3');

var config = require('../util/config');

if (!process.argv[3]) {
  console.error("Usage: ooni-upload.js <file> <date>");
  return 1;
}

var client = s3.createClient({
  s3Options: {
    accessKeyId: config.getKey("ooni_key_id"),
    secretAccessKey: config.getKey("ooni_key_secret")
  }
});

var instant = moment(process.argv[3]);

var uploader = client.uploadFile({
  localFile: process.argv[2],
  s3Params: {
    Bucket: "ooni-incoming",
    Key: "/satellite/" + instant.format("YYYY-MM-DD") + "-AS73-satellite-dns_test-v1.json"
  }
});

uploader.on('error', function(err) {
  console.error("unable to upload:", err.stack);
});

uploader.on('progress', function() {
  console.log("progress", uploader.progressMd5Amount,
            uploader.progressAmount, uploader.progressTotal);
});

uploader.on('end', function() {
  console.log("done uploading");
  return 0;
});
