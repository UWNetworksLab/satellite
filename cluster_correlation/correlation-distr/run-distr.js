var fs = require('fs');
var stream = require('stream');
var spawn = require('child_process').spawn;
var Q = require('q');
var chalk = require('chalk');
var loadMatrix = require('../correlation-matrix.js').loadMatrix;

var matrixPrefix = process.argv[2];
var outFile = process.argv[3];


var matrix = loadMatrix(matrixPrefix);
var domains = Object.keys(matrix._domains);

function writeImmFile() {
  var immFile = matrixPrefix + '.txt';

  return Q.Promise(function (resolve) {
    var outFD = fs.openSync(immFile, 'wx');

    fs.writeSync(outFD, domains.length + '\n');
    for (var i = 0; i < domains.length; i++) {
      var entries = [];
      for (var j = i + 1; j < domains.length; j++) {
        entries.push(matrix.lookup(domains[i], domains[j]));
      }
      fs.writeSync(outFD, entries.join('\n') + '\n');
    }
    fs.closeSync(outFD);

    resolve(immFile);
  });
}

function spawnSolver(immFile) {
  return Q.Promise(function (resolve) {
    console.log(chalk.blue('Spawning chainedSolvers'));

    var child = spawn('cluster_correlation/correlation-distr/bin64/chainedSolvers',
      ['log', 'vote', immFile]);

    var clusters = [];

    child.stdout.on('data',
      function (data) {
        data.toString().split('\n').filter(function (el) {
          return el !== '';
        }).forEach(function (el) {
          clusters.push(parseInt(el));
        });
      }
    );

    child.stderr.pipe(process.stderr);

    child.on('exit', function (exitCode) {
      fs.unlinkSync(immFile);
      resolve(clusters);
    });
  });
}

function processOutput(clusters) {
  var output = [];

  clusters.forEach(function (cluster, idx) {
    output[cluster - 1] = output[cluster - 1] || [];
    output[cluster - 1].push(domains[idx]);
  });

  output.sort(function (a, b) {
    return b.length - a.length;
  });

  fs.writeFileSync(outFile, JSON.stringify(output));
}

writeImmFile().then(spawnSolver).then(processOutput).then(console.log, console.error);