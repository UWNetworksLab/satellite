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
var iu = require('../util/ip_utils');

console.log(chalk.blue('Reading Input.'));
var scores = JSON.parse(fs.readFileSync(process.argv[3]));
console.log(chalk.green('Done!'));

var domains = {};
Object.keys(scores).map(function (dom) {
  domains[dom] = [];
})

var ipDomainValidation = function (ip) {
  if (!ip.length) {return;}
  try {
    ip = JSON.parse(ip);
    if (ip.length < 2) {return;}

    var doms = Object.keys(ip[1]);
    var cc = iu.getClassC(ip[0]);
    for (var i = 0; i < doms.length; i +=1) {
      if (scores[doms[i]] && scores[doms[i]][cc] !== undefined) {
        var score = scores[doms[i]][cc];
        if (!score) {score = -1;}
        score = (score + 1) / 2;
        if (ip[1][doms[i]]) {
          domains[doms[i]].push(1 - score);
        } else {
          domains[doms[i]].push(score);
        }
      }
    }
  } catch (e) {
    console.error(e, ip);
    return;
  }
  return;
};

var reduceDomains = function () {
  console.log('reducing.');
  var dscores = [];
  Object.keys(domains).forEach(function (d) {
    if (!domains[d].length) {return;}
    var score = domains[d].reduce(function (a,b) {return a + b;}, 0) / domains[d].length;
    dscores.push(score);
  });
  fs.writeFileSync(process.argv[4], JSON.stringify(dscores));
  console.log('done.');
  process.exit(0);
};

var validation = fs.createReadStream(process.argv[2]);
validation
  .pipe(es.split()).pipe(es.split(']['))
  .pipe(es.mapSync(ipDomainValidation))
  .pipe(es.wait(reduceDomains));
