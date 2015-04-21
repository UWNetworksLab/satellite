var fs = require('fs');
var Q = require('q');
var ProgressBar = require('progress');
var chalk = require('chalk');
var getClassC = require('../util/ip_utils.js').getClassC;

function collapseToClassC(table) {
  var into = {};

  Object.keys(table).forEach(function (domain) {
    into[domain] = {};

    Object.keys(table[domain]).forEach(function (ip) {
      var classC = getClassC(ip);

      into[domain][classC] = into[domain][classC] || 0;
      into[domain][classC] += table[domain][ip];
    });
  });

  return into;
}

function getIDX(triangle, domain1, domain2) {
  var idx1 = triangle._domains[domain1],
    idx2 = triangle._domains[domain2];

  if (idx1 > idx2) {
    var tmp;
    tmp = idx1;
    idx1 = idx2;
    idx2 = tmp;
  }

  return idx1 + Math.floor(0.5 * (idx2 - 1) * idx2);
}

function buildMatrix(filename) {
  var table = collapseToClassC(JSON.parse(fs.readFileSync(filename))),
    domains = Object.keys(table),
    triangle = {
      _domains: {},
      _array: new Float32Array(new ArrayBuffer(Math.floor(0.5 * (domains.length - 1) * domains.length) * 4)),
      lookup: function (domain1, domain2) {
        return domain1 === domain2 ? undefined : this._array[getIDX(this, domain1, domain2)];
      }
    };

  domains.forEach(function (domain, idx) {
    triangle._domains[domain] = idx;
  });

  console.log(chalk.blue("Building Correlation Matrix"));
  bar = new ProgressBar(':bar :percent :eta', triangle._array.length);

  for (var i = 0; i < domains.length; i++) {
    for (var j = i + 1; j < domains.length; j++) {
      var a = table[domains[i]],
        b = table[domains[j]],
        aTotal = 0,
        bTotal = 0,
        intersection = 0;

      Object.keys(a).filter(function (classC) {
        return b[classC];
      }).forEach(function (classC) {
        intersection += Math.min(b[classC], a[classC]);
      });

      Object.keys(a).forEach(function (classC) {
        aTotal += a[classC];
      });

      Object.keys(b).forEach(function (classC) {
        bTotal += b[classC];
      });

      // TODO: how to calc this
      triangle._array[getIDX(triangle, domains[i], domains[j])] = Math.max(intersection / aTotal, intersection / bTotal);

      bar.tick();
    }
  }

  return triangle;
}

exports.getMatrix = buildMatrix;