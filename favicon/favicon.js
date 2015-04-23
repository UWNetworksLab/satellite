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
 */

var http = require('http');
var fs = require('fs');
var Q = require('q');
var es = require('event-stream');
var requester = require('./requester.js');

http.globalAgent.maxSockets = 100; //TODO: optimal?
if (process.argv.length !== 4) {
  console.log('Usage:\n\tnode icons.js <SourceFile> <OutputFile>');
  process.exit(1);
}
var inFile = process.argv[2];
var outFile = process.argv[3];


fs.createReadStream(inFile)
  .pipe(es.split())
  .pipe(es.map(processIP))
  .pipe(es.join('\n'))
  .pipe(fs.createWriteStream(outFile))
  .on('error', handleError)
  .on('end', function() {
    console.log('Done!');
  });


function handleError(error) {
  console.log("Error while running: " + error);
}
function writeOutput(output) {
  return Q.nfcall(fs.writeFile, outFile, output);
}

function processIP(data, callback) {
  if (data.length === 0) {
    // Ignore Implicit newline at EOF
    return callback();
  }
  var params = JSON.parse(data);
  var ip = Object.keys(params)[0];
  var hosts = params[ip];
  var good = true;
  var lastresult = null;

  // The results of the run.
  var output = {};
  output[ip] = {};

  function oneRun() {
    var host;
    if (good) {
      host = hosts.pop();
      requester.getFavicon(ip, host, 80).then(function (result) {
        output[ip][host] = result;
        lastresult = result;
/*TODO: DEBUG*/console.log(host); console.log(lastresult);
        if (hosts.length === 0) {
          callback(null, JSON.stringify(output));
        } else {
          if (result[0] < 0) {
            // Bad result, don't keep trying
            good = false;
            setTimeout(oneRun, 0);
          } else {
            setTimeout(oneRun, 1000);
          }
        }
      }, function (error) {
        callback(JSON.stringify(error));
      }).done();
    } else {
      while (hosts.length > 0) {
        host = hosts.pop();
        output[ip][host] = lastresult;
/*TODO: DEBUG*/console.log(host); console.log(lastresult);
      }
      callback(null, JSON.stringify(output));
    }
  }
  oneRun();
}

