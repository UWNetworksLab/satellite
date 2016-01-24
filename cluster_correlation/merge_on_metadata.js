/**
 * Take a clusters.json [[domain, domain, domain], [domain,domain, domain]]
 * and clusters.ips.json {"clusterIDX"->[ip,ip,ip],...}
 * and a source of metadata on IPs, like whois or reverse PTR
 * {ip->metadata, ip->metadata}
 * to generate a merged set of clusters.
 */
'use strict';

var Q = require('Q');
var fs = require('fs');
var chalk = require('chalk');
var ProgressBar = require('progress');
var utils = require('./cluster_utils');
var es = require('event-stream');
var flatten = require('flatten');
var ip_utils = require('../util/ip_utils');

if (process.argv.length < 7) {
  console.log(chalk.red("Usage:"), "merge_on_metadata.js <clusters.json> <clusters.ip.json> <ptrs.json | whois.json> 0.9 clusters.out.json");
  process.exit(0);
}

var clusterFile = process.argv[2];
var ipFile = process.argv[3];
var metaFile = process.argv[4];
var threshold = Number(process.argv[5]);
var outFile = process.argv[6];

// line-based json where each line is an array and first element is the IP (as a string)
var loadMeta = function () {
  return Q.Promise(function (resolve, reject) {
    var map = {};
    var fillMap = function (entry) {
      if (!entry) {return;}
      var line = JSON.parse(entry);
      var ipstring = ip_utils.getClassC(line[0]);
      map[ipstring] = line[1];
    };
    fs.createReadStream(metaFile).pipe(es.split()).pipe(fillMap).on('end', function () {
      resolve(map);
    });
  });
};

// cleanup formatting & if it looks like a unique hostname try to get the common domain.
var cleanup = function(meta) {
  meta = meta.trim().toLowerCase();
  if (meta.indexOf(" ") < 0) {
    var parts = meta.split(".");
    if (parts.length > 2 && parts[0].length > 5) {
      parts.shift();
      return parts.join(".");
    }
  }
  return meta;
};

var mergeClusters = function (domains, clusters) {
  console.log(chalk.blue("Merging. Starting with " + domains.length + " clusters"));
  var tomerge = {};
  var idxs = [];
  var reclustered = [];
  for (var i = 0; i <domains.length; i += 1) {
    idxs.push(i);
  }
  Object.keys(clusters).forEach (function (idx) {
    if (clusters[idx][1] > threshold) {
      var key = clusters[idx][0];
      if (!tomerge[key]) {
        tomerge[key] = [];
      }
      tomerge[key].push(idx);
    }
  });
  Object.keys(tomerge).forEach(function (key) {
    var combined = [];
    key.forEach(function (idx) {
      combined = combined.concat(domains[idx]);
      delete idxs[idxs.indexOf(idx)];
    });
    reclustered.push(combined);
  });
  //remaining, unchanged ones.
  idxs.forEach(function (idx) {
    reclustered.push(domains[idx]);
  });
  return reclustered;
};

// turn each cluster into a dominant meta-data tag, if there is one.
var clustersToMeta = function (domains, ips, meta) {
  console.log(chalk.blue("Data Loaded. Linking Metadata."));
  var clusterSignals = {};
  return Q.Promise(function (resolve) {
    domains.forEach(function (domains, idx) {
      var cluster = ips[idx];
      if (cluster && cluster.length) {
        var metas = cluster.map(function (ip) {
          return meta[ip];
        });
        metas = flatten(metas).map(cleanup);
        clusterSignals[idx] = utils.getMostFrequentElement(metas);
        clusterSignals[idx][1] /= cluster.length;
      }
    });
    resolve(mergeClusters(domains, clusterSignals));
  });
};

Q.all([
  Q.nfcall(fs.readFile, clusterFile).then(JSON.parse).then(utils.clusterArrayToMap),
  Q.nfcall(fs.readFile, ipFile).then(JSON.parse),
  loadMeta
]).spread(clustersToMeta)
  .then(function (result) {
    fs.writeFileSync(outFile, JSON.stringify(result));
  })
  .then(undefined, console.error);
