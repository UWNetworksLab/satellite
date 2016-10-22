'use strict';

/**
 * Locally query WHOIS records for discovered IP addresses for use in subsequent
 * clustering.
 * Note: due to rate limiting, this is not enabled by default.
 */

var fs = require('fs');
var chalk = require('chalk');
var whois = require('node-whois');
var es = require('event-stream');
var mapConcurrent = require('map-stream-concurrent');
var progress = require('progressbar-stream');

if (!process.argv[2]) {
  console.error(chalk.red("Usage: find-whois.js <ips> <output.json>"));
  process.exit(1);
}
var inFile = process.argv[2];
var outFile = process.argv[3];

var CONCURRENT_REQUESTS = 10;

function whoisWorker(ip, done) {
  whois.lookup(ip, function (err, val) {
    var org = null;
    if (!err && val) {
      val.split('\n').forEach(function (l) {
        if (l.indexOf('OrgNOCName') === 0) {
          org = l.split(':')[1].trim();
        } else if(l.indexOf('netname') === 0) {
          org = l.split(':')[1].trim();
        }
      });
    }
    done(JSON.stringify([ip, org]));
  });
}

var length = fs.statSync(inFile).size;
fs.createReadStream(inFile)
    .pipe(progress({total: length}))
    .pipe(es.split())
    .pipe(mapConcurrent(CONCURRENT_REQUESTS, whoisWorker))
    .pipe(es.join('\n'))
    .pipe(fs.createWriteStream(outFile));
