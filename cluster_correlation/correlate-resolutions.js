'use strict';

var fs = require('fs');
var ProgressBar = require('progress');
var cm = require('./correlation-matrix.js');
var chalk = require('chalk');
var isReserved = require('../util/ip_utils.js').isReserved;

// Generate scores for IPs from the resolution lookup tables and a similarity matrix
// Usage: correlate-resolutions.js <domainToIp> <ipToDomain> <matrix sim prefix> <output.json>
// Output format is:
// {domain -> {ip -> score}}

var domainToIP = JSON.parse(fs.readFileSync(process.argv[2]));
var IPtoDomain = JSON.parse(fs.readFileSync(process.argv[3]));
var matrix = cm.loadMatrix(process.argv[4]);
var outFile = process.argv[5];

var out = {};

console.log(chalk.blue("Correlating %d Domains"), Object.keys(domainToIP).length);
var bar = new ProgressBar(':bar :percent :eta', {total: Object.keys(domainToIP).length});

Object.keys(domainToIP).forEach(function (domain) {
  out[domain] = {};
  var memoized = {};

  Object.keys(domainToIP[domain]).forEach(function (ip) {
    var total = 0,
      coeff = 0,
      id = Object.keys(IPtoDomain[ip]);

    if (isReserved(ip)) {
      return 0.0;
    }

    if (memoized[id]) {
      out[domain][ip] = memoized[id];
    } else {
      id.forEach(function (other) {
        total += IPtoDomain[ip][other];
        coeff += IPtoDomain[ip][other] * matrix.lookup(domain, other);
      });

      out[domain][ip] = coeff / total * domainToIP[domain][ip];
      memoized[id] = out[domain][ip];
    }
  });
  bar.tick();
});

fs.writeFileSync(outFile, JSON.stringify(out));