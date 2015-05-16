var fs = require('fs');
var Q = require('q');
var ProgressBar = require('progress');
var chalk = require('chalk');

// Usage: node correlation-matrix.js domain-classC-count [domain-classC-reweight] output-prefix
//
// [domain-classC-reweight] is optional
// - on first iteration exclude it
// - subsequent iterations use the output from the reweighting-table.js generated from the previous iteration

if (process.argv[1] && process.argv[1].indexOf('correlation-matrix') > -1 && process.argv.length == 5) {
  buildMatrix(process.argv[2], process.argv[3], process.argv[4]);
}

if (process.argv[1] && process.argv[1].indexOf('correlation-matrix') > -1 && process.argv.length == 4) {
  buildMatrix(process.argv[2], null, process.argv[3]);
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

function buildMatrix(countTable, reweightingTable, outprefix) {
  var counts = JSON.parse(fs.readFileSync(countTable)),
    domains = Object.keys(counts),
    reweights,
    magnitudes = {},
    triangle = {
      lookup: lookup,
      _domains: {},
      _buffer: new Buffer(Math.floor(0.5 * (domains.length - 1) * domains.length) * 4)
    };


  if (reweightingTable) {
    reweights = JSON.parse(fs.readFileSync(reweightingTable));
  } else {
    // re-weight everything with a 0 factor if table wasn't specified
    reweights = {};
    Object.keys(counts).forEach(function (domain) {
      reweights[domain] = {};
      Object.keys(counts[domain]).forEach(function (classC) {
        reweights[domain][classC] = 0;
      });
    });
  }

  //console.log(chalk.blue("Pruning resolutions < %1 of total per domain"));
  //domains.forEach(function (domain) {
  //  var total = 0;
  //  Object.keys(counts[domain]).forEach(function (classC) {
  //    total += counts[domain][classC];
  //  });
  //
  //  Object.keys(counts[domain]).filter(function (classC) {
  //    return counts[domain][classC] / total < 0.01;
  //  }).forEach(function (classC) {
  //    delete counts[domain][classC];
  //  });
  //});

  console.log(chalk.blue("Calculating magnitudes & filling triangle."));
  domains.forEach(function (domain, idx) {
    magnitudes[domain] = 0;
    Object.keys(counts[domain]).forEach(function (classC) {
      magnitudes[domain] += Math.pow(counts[domain][classC], 2);
    });
    magnitudes[domain] = Math.sqrt(magnitudes[domain]);

    triangle._domains[domain] = idx;
  });

  console.log(chalk.blue("Building Correlation Matrix"));  // super accurate progress bar
  bar = new ProgressBar(':bar :percent :eta', Math.floor(triangle._buffer.length / 1000));

  domains.forEach(function (a, i) {
    domains.slice(i + 1).forEach(function (b) {
      var aCounts = counts[a],
        bCounts = counts[b],
        aReweights = reweights[a],
        bReweights = reweights[b],
        offset = getOffset(triangle, a, b),
        dotProduct,
        coeff;

      dotProduct = Object.keys(aCounts).filter(function (classC) {
        return bCounts[classC];
      }).reduce(function (prev, classC) {
        var aComponent = aCounts[classC] * (1 + aReweights[classC]),
          bComponent = bCounts[classC] * (1 + bReweights[classC]);
        return prev + aComponent * bComponent;
      }, 0);

      // cosine similarity is the dot product over the product of magnitudes
      coeff = Math.min(1, dotProduct / (magnitudes[a] * magnitudes[b]));

      triangle._buffer.writeFloatLE(coeff, offset);
      if (offset % 1000 == 0) {
        bar.tick();
      }
    });
  });

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
  };
}

function loadMatrixPromise(prefix) {
  return Q({
    lookup: lookup,
    _domains: JSON.parse(fs.readFileSync(prefix + '.json')),
    _buffer: fs.readFileSync(prefix + '.bin')
  });
}

exports.buildMatrix = buildMatrix;
exports.loadMatrix = loadMatrix;
exports.loadMatrixPromise = loadMatrixPromise;
