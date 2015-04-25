/*jslint node:true*/
'use strict';

/*
 * Makes requests for favicons and records the results.
 * Requests the favicon for the Host as domain, from the ip addresses.
 *
 * Input file (json) maps domains to array of ip addresses.
 * Output file (json) maps domains to objects which map ips to results.
 *  results is an array of
 *  [http-status-code, content-length, favicon-hash, http-content-type]
 *   *                 **              **            ***
 *
 *  * Always present, either negative (see error codes below) or one of http codes
 *  ** Present if the response was valid http
 *  *** Present if response was valid http and has the header set.
 *
 * Usage
 *  node <favicons.js path> <SourceFile> <OutputFile>
 *
 *  * SourceFile should contain mappings of ip to a list of hostnames
 *  * OutputFile will contain a mapping of ip to another mapping of hostname to result
 */

var http = require('http');
var fs = require('fs');
var async = require('async');
var Q = require('q');
var es = require('event-stream');
var requester = require('./requester.js');

var CONCURRENT_IPS = 1000;

http.globalAgent.maxSockets = 10000;
if (process.argv.length !== 4) {
  console.log('Usage:\n\tnode <favicons.js path> <SourceFile> <OutputFile>');
  process.exit(1);
}
var inFile = process.argv[2];
var outFile = process.argv[3];

Q.nfcall(fs.readFile, inFile)
  .then(JSON.parse)
  .then(function(data) {
    var allIPs = Object.keys(data);
    var results = {};
    return Q.promise(function (resolveCB, rejectCB) {
      async.eachLimit(allIPs, CONCURRENT_IPS, processIP.bind(undefined, data, results), function (err) {
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
  .catch(function (err) {
    console.log(err);
  });

function processIP(data, results, ip, callback) {
  var hosts = Object.keys(data[ip]);
  var good = true;
  var lastresult = null;

  // The results of the run.
  var output = {};

  function oneRun() {
    var host;
    if (good) {
      host = hosts.pop();
      requester.getFavicon(ip, host, 80).then(function (ipresult) {
        output[host] = ipresult;
        lastresult = ipresult;
        if (hosts.length === 0) {
          results[ip] = output;
          callback(null);
        } else {
          if (ipresult[0] < 0) {
            // Bad result, don't keep trying
            good = false;
            setTimeout(oneRun, 0);
          } else {
            setTimeout(oneRun, 1000);
          }
        }
      }, function (error) {
        callback(error);
      }).done();
    } else {
      while (hosts.length > 0) {
        host = hosts.pop();
        output[host] = lastresult;
      }
      results[ip] = output;
      callback(null);
    }
  }
  oneRun();
}

