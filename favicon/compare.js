/*jslint node:true*/
'use strict';

/*
 * Compares retrieved favicons against expected favicons and returns some results
 *
 * First input file (json) maps domains to objects which map ips to results.
 *  [http-status-code, content-length, favicon-hash, http-content-type]
 *
 * Second input file (json) maps domains that have favicons to the hash of their
 *  favicons
 *
 * Output File (json) maps domains to objects which map ips to boolean
 *  (if the website returned the right favicon if one exists)
 *
 * Usage
 *  node <compare.js path> <ActualResults> <ExpectedHashes> <OutputFile>
 *
 * Note: it might be useful to run thus in paralell over several cores to speed up
 *  processing. Split input then do something like this:
 * find ../fav/ -name "fava*" | xargs -P 4 -I {} node favicon/compare.js ../domains-localvalidation.json {} {}.out
 */

var fs = require('fs');
var async = require('async');
var Q = require('q');
var es = require('event-stream');
var mapConcurrent = require('map-stream-concurrent');

if (process.argv.length !== 5) {
  console.log('Usage:\n\tnode <compare.js path> <ExpectedHashes> <ActualResults> <OutputFile>');
  process.exit(1);
}
var expected = JSON.parse(fs.readFileSync(process.argv[2]));
var actual = fs.createReadStream(process.argv[3]);
var outFile = fs.createWriteStream(process.argv[4]);

function mapToBoolean(data) {
  var ipDataArray, ip, hosts, results = {};
  try {
    ipDataArray = JSON.parse(data);
  } catch (e) {
    return;
  }

  ip = ipDataArray[0];
  hosts = ipDataArray[1];

  Object.keys(hosts).forEach(function (host) {
    if (expected[host]) {
      // Check that it gives back a 200 and check hash
      results[host] = hosts[host][0] === 200 && hosts[host][2] === expected[host];
    }
  });
  if (Object.keys(results).length > 0) {
    return [ip, results];
  } else {
    return;
  }
}

actual
  .pipe(es.split())
  .pipe(es.mapSync(mapToBoolean))
  .pipe(es.stringify())
  .pipe(es.join('\n'))
  .pipe(outFile);

