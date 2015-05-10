var fs = require('fs');
var Q = require('q');
var ProgressBar = require('progress');
var chalk = require('chalk');


// Usage: node correlation-matrix.js [domain-classC-count table] [domain-classC-coeff table] [output prefix]
if (process.argv[1] && process.argv[1].indexOf('correlation-matrix') > -1 && process.argv.length == 5) {
  buildMatrix(process.argv[2], process.argv[3], process.argv[4]);
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
    return 1.0;
  }

  return this._buffer.readFloatLE(getOffset(this, domain1, domain2));
}

function buildMatrix(countTable, coeffTable, outprefix) {
  var counts = JSON.parse(fs.readFileSync(countTable)),
    coeffs = JSON.parse(fs.readFileSync(coeffTable)),
    domains = Object.keys(counts),
    totals = {},
    triangle = {
      lookup: lookup,
      _domains: {},
      _buffer: new Buffer(Math.floor(0.5 * (domains.length - 1) * domains.length) * 4)
    };

  console.log(chalk.blue("Calculating totals & filling triangle."));
  domains.forEach(function (domain, idx) {
    totals[domain] = 0;
    Object.keys(counts[domain]).forEach(function (classC) {
      totals[domain] += counts[domain][classC];
    });

    triangle._domains[domain] = idx;
  });

  console.log(chalk.blue("Building Correlation Matrix"));
  bar = new ProgressBar(':bar :percent :eta', Math.floor(triangle._buffer.length / 1000));

  for (var i = 0; i < domains.length; i++) {
    for (var j = i + 1; j < domains.length; j++) {
      var a = counts[domains[i]],
        b = counts[domains[j]],
        aCoeffs = coeffs[domains[i]],
        bCoeffs = coeffs[domains[j]],
        aIntersection = 0,
        bIntersection = 0,
        offset = getOffset(triangle, domains[i], domains[j]),
        coeff;

      Object.keys(a).forEach(function (classC) {
        if (b[classC]) {
          aIntersection += a[classC] + a[classC] * (aCoeffs[classC] - (1 - aCoeffs[classC]));
          bIntersection += b[classC] + b[classC] * (bCoeffs[classC] - (1 - bCoeffs[classC]));
        }
      });

      coeff = Math.max(0, Math.min(1, (aIntersection / totals[domains[i]] + bIntersection / totals[domains[j]]) / 2.0));

      triangle._buffer.writeFloatLE(coeff, offset);
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

function getRandomSubarray(arr, size) {
  var shuffled = arr.slice(0), i = arr.length, min = i - size, temp, index;
  while (i-- > min) {
    index = Math.floor((i + 1) * Math.random());
    temp = shuffled[index];
    shuffled[index] = shuffled[i];
    shuffled[i] = temp;
  }
  return shuffled.slice(min);
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
