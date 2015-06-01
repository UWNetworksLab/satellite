var fs = require('fs');
var ProgressBar = require('progress');
var cm = require('./correlation-matrix.js');
var chalk = require('chalk');
var isReserved = require('../util/ip_utils.js').isReserved;

// reweighting-table.js generates table used in subsequent iterations of correlation-matrix building
//
// Usage: node ./reweighting-table.js <domain-classC-count> <classC-domain-count> <matrix-prefix> <output>
//
// Output: domain -> classC -> [-1, 1]
// -1 no correlation between domain/classC
// 1 highly correlated domain/classC pair


var domainToClassC = JSON.parse(fs.readFileSync(process.argv[2]));
var ClassCToDomain = JSON.parse(fs.readFileSync(process.argv[3]));
var matrix = cm.loadMatrix(process.argv[4]);
var outFile = process.argv[5];

var out = {};

console.log(chalk.blue("Weighting %d Domains"), Object.keys(domainToClassC).length);
var bar = new ProgressBar(':bar :percent :eta', {total: Object.keys(domainToClassC).length});

Object.keys(domainToClassC).forEach(function (domain) {
  out[domain] = {};
  var memoized = {};

  Object.keys(domainToClassC[domain]).forEach(function (ip) {
    var total = 0,
      coeff = 0,
      id = Object.keys(ClassCToDomain[ip])
        .filter(function (other) {
          return domain !== other; // let's not count ourselves
        });

    if (isReserved(ip)) {
      return -0.0;
    }

    if (memoized[id]) {
      out[domain][ip] = memoized[id];
    } else {
      id.forEach(function (other) {
        total += ClassCToDomain[ip][other];
        coeff += ClassCToDomain[ip][other] * matrix.lookup(domain, other);
      });

      out[domain][ip] = total > 0 ? (coeff / total) - (1 - (coeff / total)) : 0;

      memoized[id] = out[domain][ip];
    }
  });
  bar.tick();
});

fs.writeFileSync(outFile, JSON.stringify(out));