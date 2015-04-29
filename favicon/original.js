/*jslint node:true*/
'use strict';

/*
 * Makes requests for favicons using local dns resolution
 *
 * Input file (json) contains domains to get favicons for
 * Output file (json) maps domains to the hash of the favicon
 *  results is a hash of
 *  { "<domain>": "<hash>" ...}
 *
 * Usage
 *  node <original.js path> <SourceFile> <OutputFile>
 *
 */

var http = require('http');
var fs = require('fs');
var async = require('async');
var Q = require('q');
var requester = require('./requester.js');

var CONCURRENT_HOSTS = 100;

http.globalAgent.maxSockets = 1000;
if (process.argv.length !== 4) {
  console.log('Usage:\n\tnode <orignal.js path> <SourceFile> <OutputFile>');
  process.exit(1);
}
var inFile = process.argv[2];
var outFile = process.argv[3];

Q.nfcall(fs.readFile, inFile)
  .then(function(data) {
    var allHosts = data.toString().split('\n');
    var results = {};
    return Q.promise(function (resolveCB, rejectCB) {
      async.eachLimit(allHosts, CONCURRENT_HOSTS, getFavicon.bind(undefined, results), function (err) {
        if (err) {
          rejectCB(err);
        } else {
          resolveCB(results);
        }
      });
    });
  })
  .then(JSON.stringify)
  .then(function(output) { return Q.nfcall(fs.writeFile, outFile, output); })
  .then(function() { console.log('\nDone'); return; })
  .catch(function (err) {
    console.log(err);
  });

function getFavicon(results, host, callback) {
  requester.getFavicon(host, host, 80).then(
    function (result) {
      if (result[0] === 404) {
        console.log('No favicon for host ' + host);
      } else if (result[0] === 200) {
        results[host] = result[2]; // Grab hash
      } else {
        console.log('Host ' + host + ' did not return a favicon status: ' + result[0]);
      }
      callback();
    },
    function (err) { callback(err); }
  ).done();
}
