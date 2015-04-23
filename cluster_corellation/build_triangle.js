var fs = require('fs');
var Q = require('q');
var ProgressBar = require('progress');
var chalk = require('chalk');
var getClassC = require('../util/ip_utils.js').getClassC;


// Usage: node build_triangle.js [domain-ip-count table] [output prefix]
if (process.argv[1].indexOf('build_triangle') > -1) {
  buildMatrix(process.argv[2], process.argv[3]);
}

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

function getOffset(triangle, domain1, domain2) {
  var idx1 = triangle._domains[domain1],
    idx2 = triangle._domains[domain2];

  if (idx1 > idx2) {
    var tmp;
    tmp = idx1;
    idx1 = idx2;
    idx2 = tmp;
  }

  return (idx1 + Math.floor(0.5 * (idx2 - 1) * idx2)) * 4;
}

function lookup(domain1, domain2) {
  if (domain1 === domain2) {
    return undefined;
  }

  return this._buffer.readFloatLE(getOffset(this, domain1, domain2));
}

function buildMatrix(domainToIP, outprefix) {
  var table = collapseToClassC(JSON.parse(fs.readFileSync(domainToIP))),
    domains = Object.keys(table),
    triangle = {
      lookup: lookup,
      _domains: {},
      _buffer: new Buffer(Math.floor(0.5 * (domains.length - 1) * domains.length) * 4)
    };

  domains.forEach(function (domain, idx) {
    triangle._domains[domain] = idx;
  });

  console.log(chalk.blue("Building Correlation Matrix"));
  bar = new ProgressBar(':bar :percent :eta', Math.floor(triangle._buffer.length / 1000));

  for (var i = 0; i < domains.length; i++) {
    for (var j = i + 1; j < domains.length; j++) {
      var a = table[domains[i]],
        b = table[domains[j]],
        total = 0,
        intersection = 0,
        offset = getOffset(triangle, domains[i], domains[j]);

      Object.keys(a).forEach(function (classC) {
        if (b[classC]) {
          intersection += a[classC] + b[classC];
        }
        total += a[classC];
      });

      Object.keys(b).forEach(function (classC) {
        total += b[classC];
      });

      triangle._buffer.writeFloatLE(intersection / total, offset);

      if (offset % 1000 == 0) {
        bar.tick();
      }
    }
  }

  if (outprefix) {
    fs.writeFileSync(outprefix + '.bin', triangle._buffer);
    fs.writeFileSync(outprefix + '.json', JSON.stringify(triangle._domains));
  }

  return triangle;
}

function loadMatrix(prefix) {
  return {
    lookup: lookup,
    _domains: JSON.parse(fs.readFileSync(prefix + '.json')),
    _buffer: fs.readFileSync(prefix + '.bin')
  }
}

exports.buildMatrix = buildMatrix;
exports.loadMatrix = loadMatrix;
