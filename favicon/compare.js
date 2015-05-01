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
 */

var http = require('http');
var fs = require('fs');
var async = require('async');
var Q = require('q');
var es = require('event-stream');
var requester = require('./requester.js');

var CONCURRENT_IPS = 1000;

http.globalAgent.maxSockets = 10000;
if (process.argv.length !== 5) {
  console.log('Usage:\n\tnode <compare.js path> <ActualResults> <ExpectedHashes> <OutputFile>');
  process.exit(1);
}
var actualFile = process.argv[2];
var expectedFile = process.argv[3];
var outFile = process.argv[4];

Q.all([
    Q.nfcall(fs.readFile, actualFile).then(JSON.parse),
    Q.nfcall(fs.readFile, expectedFile).then(JSON.parse)
  ])
  .spread(function(actual, expected) {
    var results = {};
    Object.keys(actual).forEach(function (ip) {
      var ipData = actual[ip];
      var ipRes = {};
      Object.keys(ipData).forEach(function(host) {
        if (expected[host]) {
          // Check that it gives back a 200 and check hash
          ipRes[host] = ipData[host][0] === 200 && ipData[host][2] === expected[host];
        }
      });
      results[ip] = ipRes;
    });
    return results;
  }, function (err1, err2) {
    console.log(err1);
    console.log(err2);
  })
  .then(JSON.stringify)
  .then(function (output) { return Q.nfcall(fs.writeFile, outFile, output); })
  .then(function () { console.log('Done'); })
  .catch(function(error) { console.log(error); });

