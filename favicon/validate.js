/*jslint node:true*/
'use strict';

/*
 * Generate scoring of how well the IP scoring from cluster_correlation compares
 * to known successful and failed attempts at favicon resolution.
 *
 * Usage
 *  node validate.js <validation.jsonlines> <scores> <output>
 *  Where:
 *   validation comes from favicon/compare.js
 *   domainToIp / iptodomain comes from asn_collapse-classC_domain or ip_domain
 *   scores comes from correlate-resolutions.js
 *  output format is per-domain error. summary stats are printed.
 */

var chalk = require('chalk');
var es = require('event-stream');
var fs = require('fs');

console.log(chalk.blue('Reading Input.'));
var scores = JSON.parse(fs.readFileSync(process.argv[3]));
console.log(chalk.green('Done!'));

var domains = {};
Object.keys(scores).map(function (dom) {
  domains[dom] = [];
})

var ipDomainValidation = function (ip) {
  if (!ip.length) {return;}
  if (ip[0] !== '[') {
    ip = '[' + ip;
  }
  if (ip[ip.length - 1] !== ']') {
    ip = ip + ']';
  }
  try {
    ip = JSON.parse(ip);
  } catch (e) {
    console.error(e, ip);
    return;
  }

  Object.keys(ip[1]).forEach(function (domain) {
    if (ip[1][domain]) {
      domains[domain].push(1 - scores[domain][ip[0]]);
    } else {
      domains[domain].push(scores[domain][ip[0]]);
    }
  });
};

var reduceDomains = function () {
  console.log('reducing.');
  var dscores = [];
  Object.keys(domains).forEach(function (d) {
    var score = domains[d].reduce(function (a,b) {return a + b;}) / domains[d].length;
    dscores.push(score);
  });
  fs.writeFileSync(process.argv[4], JSON.stringify(dscores));
  console.log('done.');
  process.exit(0);
};

var validation = fs.createReadStream(process.argv[2]);
validation
  .pipe(es.split()).pipe(es.split(']['))
  .pipe(es.map(ipDomainValidation))
  .on('finish', reduceDomains);
