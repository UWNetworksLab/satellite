'use strict';

var fs = require('fs');
var chalk = require('chalk');

console.log(chalk.blue("Reading"));
var DomainToIP = JSON.parse(fs.readFileSync(process.argv[2]));
var scores = JSON.parse(fs.readFileSync(process.argv[3]));
var outFile = process.argv[4];

console.log(chalk.blue("rescoring on IP diversity."));

Object.keys(DomainToIP).forEach(function (domain) {
  var totalResolutions = 0;
  Object.keys(DomainToIP[domain]).forEach(function (ip) {
    totalResolutions += DomainToIP[domain][ip];
  });
  Object.keys(DomainToIP[domain]).forEach(function (ip) {
    var frac = DomainToIP[domain][ip]/totalResolutions;
    var weight = Math.pow(frac, 1/3);
    scores[domain][ip] = weight + (1 - weight) * (scores[domain][ip] + 1) / 2;
  });
});

fs.writeFileSync(outFile, JSON.stringify(scores));
