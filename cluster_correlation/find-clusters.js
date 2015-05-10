var fs = require('fs');
var chalk = require('chalk');
var ProgressBar = require('progress');
var loadMatrix = require('./correlation-matrix.js').loadMatrix;

var matrix = loadMatrix(process.argv[2]);
var permutations = parseInt(process.argv[3]);
var outFD = fs.openSync(process.argv[4], 'w');


function vote(domains) {
  var result = {
    clusters: [],
    domains: domains,
    domainToCluster: []
  };

  domains.forEach(function (domain, domainIdx) {
    var bestCluster,
      bestNetWeight = 0;

    result.clusters.forEach(function (cluster, clusterIdx) {
      var netWeight = cluster.reduce(function (prev, other) {
        var coeff = matrix.lookup(domain, other);
        return prev + coeff - (1 - coeff);
      }, 0);

      if (netWeight > bestNetWeight) {
        bestNetWeight = netWeight;
        bestCluster = clusterIdx;
      }
    });

    if (bestCluster && bestNetWeight > 0) {
      result.clusters[bestCluster].push(domain);
      result.domainToCluster[domainIdx] = bestCluster;
    } else {
      result.domainToCluster[domainIdx] = result.clusters.length;
      result.clusters.push([domain]);
    }
  });

  return result;
}

// we want to minimize this
// probably a better number to use than weight but also more expensive to calc
function objective(clusters) {
  var result = 0;

  for (var i = 0; i < clusters.domains.length; i++) {
    for (var j = i + 1; j < clusters.domains.length; j++) {
      if (clusters.domainToCluster[i] == clusters.domainToCluster[j]) {
        result += 1 - matrix.lookup(a, b);
      } else {
        result += matrix.lookup(a, b);
      }
    }
  }

  return result;
}

// we want to maximize this
function weight(clusters) {
  var result = 0;

  clusters.clusters.forEach(function (cluster) {
    var i, j;
    for (i = 0; i < cluster.length; i++) {
      for (j = i + 1; j < cluster.length; j++) {
        var coeff = matrix.lookup(cluster[i], cluster[j]);
        result += coeff - (1 - coeff);
      }
    }
  });

  return result;
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

console.log(chalk.blue("Trying %d permutations"), permutations);
var bar = new ProgressBar(':bar :percent :eta', permutations);
for (var i = 0; i < permutations; i++) {
  var clusters = vote(shuffle(Object.keys(matrix._domains)));

  fs.writeSync(outFD, JSON.stringify({
    clusters: clusters.clusters,
    weight: weight(clusters)
  }));

  bar.tick();
}

fs.closeSync(outFD);



