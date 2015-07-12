'use strict';

/**
 * Locally query PTR records for discovered IP addresses for use in subsequent
 * clustering.
 */

var fs = require('fs');
var chalk = require('chalk');
var dns = require('dns');
var es = require('event-stream');
var mapConcurrent = require('map-stream-concurrent');

if (!process.argv[2]) {
  console.error(chalk.red("Usage: find-ptrs.js <ips> <output.json>"));
  process.exit(1);
}
var inFile = process.argv[2];
var outFile = process.argv[3];

var CONCURRENT_DNS_REQUESTS = 10;

function dnsWorker(ip, done) {
  dns.reverse(ip, function (err, val) {
    if (err || !val) {
      val = [];
    }
    done(JSON.stringify([ip, val]));
  });
}

fs.createReadStream(inFile)
    .pipe(es.split())
    .pipe(mapConcurrent(CONCURRENT_DNS_REQUESTS, dnsWorker))
    .pipe(es.join('\n'))
    .pipe(fs.createWriteStream(outFile));

