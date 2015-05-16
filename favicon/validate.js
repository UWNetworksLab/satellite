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
var cdomains = {};
var t_c = 0, t_f = 0, t_tf = 0, t_tt = 0;
Object.keys(scores).map(function (dom) {
  cdomains[dom] = [];
  domains[dom] = [];
})
console.log('domains read');

var ipDomainValidation = function (ip) {
  if (!ip.length) {return;}
  try {
    ip = JSON.parse(ip);
    if (ip.length < 2) { return; }

    var doms = Object.keys(ip[1]);
    var cc = iu.getClassC(ip[0]);
    for (var i = 0; i < doms.length; i += 1) {
      var domain = doms[i];
      if (scores[domain] && scores[domain][cc] !== undefined) {
        var score = scores[domain][cc];
        if (score && ip[1][domain]) {
          t_tf += 1;
          if (score > 0.5) {
            t_c += 1;
          }
          cdomains[domain].push(score > 0.5 ? 1 : 0);
          domains[domain].push(score);
        } else if (score) {
          t_tf += 1;
          if (score < 0.5) {
            t_f += 1;
          }
          domains[domain].push(1 - score);
        }
      }
    }
  } catch (e) {
    console.error(e, ip);
  }
  return;
};

var reduceDomains = function () {
  console.log('reducing.');
  var dscores = [];
  var fracs = [];
  Object.keys(domains).forEach(function (d) {
    if (!domains[d].length) { return; }
    var score = domains[d].reduce(function (a,b) {return a + b;}, 0) / domains[d].length;
    dscores.push(score);

    var frac = cdomains[d].reduce(function (a,b) {return a + b;}, 0) / domains[d].length;
    fracs.push(frac);
  });
  fs.writeFileSync(process.argv[4], JSON.stringify(dscores));
  fs.writeFileSync(process.argv[4]+'.frac', JSON.stringify(fracs));
  console.log('done.');
  console.log('Gave score of true to', t_c, ' of ', t_tt);
  console.log('Gave score of false to', t_f, ' of ', t_tf)
  process.exit(0);
};

var validation = fs.createReadStream(process.argv[2]);
validation
  .pipe(es.split())
  .pipe(es.mapSync(ipDomainValidation))
  .pipe(es.wait(reduceDomains));
