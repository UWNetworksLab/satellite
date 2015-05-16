var fs = require('fs');
var ProgressBar = require('progress');
var cm = require('./correlation-matrix.js');
var chalk = require('chalk');

// reweighting-table.js generates table used in subsequent iterations of correlation-matrix building

var domainToIP = JSON.parse(fs.readFileSync(process.argv[2]));
var IPtoDomain = JSON.parse(fs.readFileSync(process.argv[3]));
var matrix = cm.loadMatrix(process.argv[4]);
var outFile = process.argv[5];

var out = {};

// domain -> classC -> [-1, 1]
//
// -1 no correlation between domain/classC
// 1 highly correlated domain/classC pair

console.log(chalk.blue("Correlating %d Domains"), Object.keys(domainToIP).length);
var bar = new ProgressBar(':bar :percent :eta', {total: Object.keys(domainToIP).length});

Object.keys(domainToIP).forEach(function (domain) {
  out[domain] = {};
  var memoized = {};

  Object.keys(domainToIP[domain]).forEach(function (ip) {
    var total = 0,
      coeff = 0,
      id = Object.keys(IPtoDomain[ip])
        .filter(function (other) {
          return domain !== other; // let's not count ourselves
        });

    if (memoized[id]) {
      out[domain][ip] = memoized[id];
    } else {
      id.forEach(function (other) {
        total += IPtoDomain[ip][other];
        coeff += IPtoDomain[ip][other] * matrix.lookup(domain, other);
      });

      out[domain][ip] = total > 0 ? (coeff / total) - (1 - (coeff / total)) : 0;

      memoized[id] = out[domain][ip];
    }
  });
  bar.tick();
});

fs.writeFileSync(outFile, JSON.stringify(out));
