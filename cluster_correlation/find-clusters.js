var Q = require('q');
var ProgressBar = require('progress');
var fs = require('fs');
var chalk = require('chalk');
var loadMatrix = require('./correlation-matrix.js').loadMatrix;

var PERMUTATIONS = 10;

var matrix = loadMatrix(process.argv[2]);
var outFile = process.argv[3];

var domains = Object.keys(matrix._domains);

function clusterDomains(domains) {
  var clusters = [];
  domains.forEach(function (domain) {
    var bestCluster,
      bestNetWeight = 0;

    clusters.forEach(function (cluster) {
      var netWeight = cluster.reduce(function (prev, other) {
        var coeff = matrix.lookup(domain, other);
        return prev + coeff - (1 - coeff);
      }, 0);

      if (netWeight > bestNetWeight) {
        bestNetWeight = netWeight;
        bestCluster = cluster;
      }
    });

    if (bestCluster && bestNetWeight > 0) {
      bestCluster.push(domain);
    } else {
      clusters.push([domain]);
    }
  });
  return clusters;
}

function findBestClustering(clusterings) {
  var bestClustering = undefined,
    bestNetWeight = 0;

  console.log(chalk.blue("\nFinding best permutation"));

  clusterings.forEach(function (clustering) {
    var netWeight = 0;
    clustering.forEach(function (cluster) {
      var i, j;
      for (i = 0; i < cluster.length; i++) {
        for (j = i + 1; j < cluster.length; j++) {
          var coeff = matrix.lookup(cluster[i], cluster[j]);
          netWeight += coeff - (1 - coeff);
        }
      }
    });

    if (netWeight > bestNetWeight) {
      bestNetWeight = netWeight;
      bestClustering = clustering;
    }
  });

  console.log(chalk.green('Done.'));
  return bestClustering;
}

function shuffle(array) {
  var remaining = array.length, temp, index;
  while (remaining > 0) {
    index = Math.floor(Math.random() * remaining);
    remaining--;
    temp = array[remaining];
    array[remaining] = array[index];
    array[index] = temp;
  }
  return array;
}

console.log(chalk.blue("Trying %d permutations"), PERMUTATIONS);
var bar = new ProgressBar(':bar :percent :eta', PERMUTATIONS);
var clusterings = [];
for (var i = 0; i < PERMUTATIONS; i++) {
  clusterings.push(clusterDomains(shuffle(domains)));
  bar.tick();
}

fs.writeFileSync(outFile, JSON.stringify(findBestClustering(clusterings)));