/*jslint node:true*/
'use strict';

/*
 * Makes requests for favicons and records the results.
 * Requests the favicon for the Host as domain, from the ip addresses.
 *
 * Input file (json) maps domains to array of ip addresses.
 * Output file (json) maps domains to objects which map ips to results.
 *  results is an array of
 *  [favicon-hash, content-length, http-status-code, http-content-type]
 */

var fs = require('fs');
var Q = require('q');

var requester = require('./requester.js');

if (process.argv.length !== 4) {
  console.log('Usage:\n\tnode icons.js <SourceFile> <OutputFile>');
  process.exit(1);
}

var inFile = process.argv[2];
var outFile = process.argv[3];

Q.nfcall(fs.readFile, inFile)
  .then(start,
    function(err) {
      console.log('Could not open file' + inFile);
    }
  );

function start(input) {
  var addr = '';
  console.log(input);
}
