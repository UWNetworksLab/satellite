/*jslint node:true*/
'use strict';

/*
 * Takes a line split mapping of domain->asn->count (date).asn.json
 * Outputs a domain -> country (src) -> country (dest) -> count mapping
 *                                   -> country (dominant)
 * - For every domain, for every country, what country does it resolve to and
 *   how many times does that country resolve to the destination country
 *
 * Usage:
 *  node <path to location.js> <inputfile> <outputfile>
 *  node location_aggregation/location.js runs/(date).asn.json runs/(date).location.json
 */

var Q = require('q');
var fs = require('fs');
var stream = require('stream');
var es = require('event-stream');
var chalk = require('chalk');
var ip2country = require('ip2country');
var asn2country = require('../asn_aggregation/asn_country.js');

if (process.argv.length !== 4) {
  console.log('Usage:\n\tnode <path to location.js> <inputfile> <outputfile>');
  process.exit(1);
}

var inFile = fs.createReadStream(process.argv[2]);
var outFile = fs.createWriteStream(process.argv[3]);

setupDependencies()
  .then(function () {
    inFile
      .pipe(es.split())
      .pipe(es.parse())
      .pipe(es.mapSync(processDomain))
      .pipe(getCombinerStream())
      .pipe(es.stringify())
      .pipe(outFile);
  })
  .catch(function (err) {
    console.log(err);
  });

function setupDependencies() {
  return asn2country.onReady;
}

/*
 * Given the data for a domain, process that domain
 */
function processDomain(data) {
  var result = {};
  var asns = Object.keys(data).filter(function (d) { return !isNaN(d); });
  var domain = data.name;
  asns.forEach(function (asn) {
    var srcCountry = asn2country.db[asn];
    if (!result[srcCountry]) {
      result[srcCountry] = {};
    }
    var ips = Object.keys(data[asn]);
    ips.forEach(function (ip) {
      var destCountry = ip2country(ip);
      if (!result[srcCountry][destCountry]) {
        result[srcCountry][destCountry] = 0;
      }
      result[srcCountry][destCountry] += data[asn][ip];
    });
  });
  return {
    domain: domain,
    result: result
  };
}

function getCombinerStream() {
  var combiner = new stream.Transform({objectMode: true});
  combiner.__result = {};
  // Chunk: {domain: "www.google.com", result: { "US": { "US": 1, ... }, ...}}
  combiner._transform = function (chunk, encoding, done) {
    this.__result[chunk.domain] = chunk.result;
    done();
  };
  combiner._flush = function (done) {
    this.push(this.__result);
    done();
  };
  return combiner;
}

