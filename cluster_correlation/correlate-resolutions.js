var fs = require('fs');
var ProgressBar = require('progress');
var cm = require('./correlation-matrix.js');
var chalk = require('chalk');

var domainToIP = JSON.parse(fs.readFileSync(process.argv[2]));
var IPToDomain = JSON.parse(fs.readFileSync(process.argv[3]));
var matrix = cm.loadMatrix(process.argv[4]);
var outFile = process.argv[5];

var out = {};

console.log(chalk.blue("Correlating %d Domains"), Object.keys(domainToIP).length);
var bar = new ProgressBar(':bar :percent :eta', {total: Object.keys(domainToIP).length});

Object.keys(domainToIP).forEach(function (domain) {
  out[domain] = {};
  Object.keys(domainToIP[domain]).forEach(function (ip) {
    var total = 0,
      coeff = 0;

    Object.keys(IPToDomain[ip]).forEach(function (other) {
      total += IPToDomain[ip][other];
      coeff += IPToDomain[ip][other] * matrix.lookup(domain, other);
    });

    out[domain][ip] = {
      coeff: coeff / total,
      total: domainToIP[domain][ip]
    }
  });
  bar.tick();
});

fs.writeFileSync(outFile, JSON.stringify(out));