'use strict';

/**
 * Determines the IPs that are in different clusters.
 * Usage: cluster-footprint.js <clusters.json> <classC-domain.json> <matrix prefix> <output.json> [strategy]
 * Output is {clusterIdx -> [ip's in cluster]}
 */
var fs = require('fs');
var Q = require('q');
var chalk = require('chalk');
var ProgressBar = require('progress');
var loadMatrix = require('./correlation-matrix.js').loadMatrixPromise;


var clusterFile = process.argv[2];
var ipDomainFile = process.argv[3];
var matrixFile = process.argv[4];
var outFile = process.argv[5];


// map from domain -> unique cluster id
function getClusterMap(clusters) {
  var result = {};

  return Q.Promise(function (resolve) {
    clusters.forEach(function (cluster, idx) {
      if (!cluster) {
        return;
      }
      cluster.forEach(function (domain) {
        result[domain] = idx;
      });
    });

    result._clusters = clusters;
    resolve(result);
  });
}

// assign clusters to ips based on cluster with most resolutions
function assignClusters1(clusterMap, ipDomains) {
  var result = {};

  return Q.Promise(function (resolve) {
    var bar;

    console.log(chalk.blue("Assigning Clusters"));
    bar = new ProgressBar(':bar :percent :eta', Object.keys(ipDomains).length / 100);

    Object.keys(ipDomains).forEach(function (ip, ipIdx) {
      var clusterCounts = {},
        domainCounts = ipDomains[ip],
        maxCount = 0,
        maxID;

      Object.keys(domainCounts).forEach(function (domain) {
        var clusterID = clusterMap[domain];
        clusterCounts[clusterID] = clusterCounts[clusterID] || 0;
        clusterCounts[clusterID] += domainCounts[domain];
      });

      Object.keys(clusterCounts).forEach(function (clusterID) {
        if (clusterCounts[clusterID] > maxCount) {
          maxCount = clusterCounts[clusterID];
          maxID = clusterID;
        }
      });

      result[maxID] = result[maxID] || [];
      result[maxID].push(ip);

      if (ipIdx % 100 === 0) {
        bar.tick();
      }
    });

    resolve(result);
  });
}

// IPs are considered to be valid for a cluster if
// 1. they show up in >1/2 of domains in cluster
// 2. they are resolved by an ASN other than the one they are in
// 3. they are resolved more than a nominal (~50) amount.
function assignClusters3(clusterMap, ipDomains) {
  var result = {};

  return Q.Promise(function (resolve) {
    var bar;

    console.log(chalk.blue("Assigning Clusters"));
    bar = new ProgressBar(':bar :percent :eta', Object.keys(ipDomains).length / 100);

    Object.keys(ipDomains).forEach(function (ip, ipIdx) {
      var clusterCounts = {},
        domainCounts = ipDomains[ip];

      Object.keys(domainCounts).forEach(function (domain) {
        var clusterID = clusterMap[domain];
        clusterCounts[clusterID] = clusterCounts[clusterID] || 0;
        if (domainCounts[domain] > 50) {
          clusterCounts[clusterID] += 1;
        }
      });

      Object.keys(clusterCounts).forEach(function (clusterID) {
        if (clusterCounts[clusterID] > clusterMap._clusters[clusterID].length / 2) {
          result[clusterID] = result[clusterID] || [];
          result[clusterID].push(ip);
        }
      });

      if (ipIdx % 100 === 0) {
        bar.tick();
      }
    });

    resolve(result);
  });
}


// assign cluster with highest correlation to ip
function assignClusters2(clusterMap, ipDomains, matrix) {
  var result = {};

  return Q.Promise(function (resolve) {
    var bar;

    console.log(chalk.blue("Assigning Clusters"));
    bar = new ProgressBar(':bar :percent :eta', Object.keys(ipDomains).length / 100);

    Object.keys(ipDomains).forEach(function (ip, ipIdx) {
      var clusterWeights = {},
        domainCounts = ipDomains[ip],
        maxWeight = 0,
        maxID,
        domains = Object.keys(domainCounts);

      domains.forEach(function (a, i) {
        var aID = clusterMap[a];

        domains.slice(i + 1).forEach(function (b) {
          var bID = clusterMap[b],
            weight = matrix.lookup(a, b) * Math.min(domainCounts[a], domainCounts[b]);

          clusterWeights[aID] = clusterWeights[aID] || 0;
          clusterWeights[aID] += weight;
          clusterWeights[bID] = clusterWeights[bID] || 0;
          clusterWeights[bID] += weight;
        });
      });

      Object.keys(clusterWeights).forEach(function (clusterID) {
        if (clusterWeights[clusterID] > maxWeight) {
          maxWeight = clusterWeights[clusterID];
          maxID = clusterID;
        }
      });

      result[maxID] = result[maxID] || [];
      result[maxID].push(ip);

      if (ipIdx % 100 === 0) {
        bar.tick();
      }
    });

    resolve(result);
  });
}

var strategy = assignClusters3;
if (process.argv[6] && process.argv[6] === 'max') {
  strategy = assignClusters1;
}


Q.all([
  Q.nfcall(fs.readFile, clusterFile).then(JSON.parse).then(getClusterMap),
  Q.nfcall(fs.readFile, ipDomainFile).then(JSON.parse),
  loadMatrix(matrixFile)
]).spread(strategy)
  .then(function (result) {
    fs.writeFileSync(outFile, JSON.stringify(result));
  })
  .then(undefined, console.error);
