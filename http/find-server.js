'use strict';

/**
 * Locally query server headers of discovered IP addresses for use in subsequent
 * clustering.
 */

var fs = require('fs');
var http = require('http');
var chalk = require('chalk');
var es = require('event-stream');
var mapConcurrent = require('map-stream-concurrent');
var progress = require('progressbar-stream');
var config = require('../util/config');


if (!process.argv[2]) {
  console.error(chalk.red("Usage: find-server.js <ips> <output.json>"));
  process.exit(1);
}
var inFile = process.argv[2];
var outFile = process.argv[3];

var CONCURRENT_REQUESTS = 10;

function httpWorker(ip, done) {
  http.get({
    hostname: ip,
    agent: false,
    timeout: 1000,
    localAddress: config.getKey('local_ip')
  }, function (resp) {
    var server ="";
    if (resp.headers && resp.headers.server) {
      server = resp.headers.server;
    }
    done(JSON.stringify([ip, resp.statusCode, server]));
  }).on('error',function(e) {
    done(JSON.stringify([ip, 504, ""]));
  });
}

var length = fs.statSync(inFile).size;
fs.createReadStream(inFile)
    .pipe(progress({total: length}))
    .pipe(es.split())
    .pipe(mapConcurrent(CONCURRENT_REQUESTS, httpWorker))
    .pipe(es.join('\n'))
    .pipe(fs.createWriteStream(outFile));
