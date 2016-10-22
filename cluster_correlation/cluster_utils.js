/**
 * A set of common utility functions used by multiple scripts in this directory.
 */
'use strict';

var Q = require('Q');

// map from domain -> unique cluster id
exports.clusterArrayToMap = function (clusters) {
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
};

// Get the most frequent element, and a count of how many times it appears.
exports.getMostFrequentElement = function (arr) {
  var counts = {};
  var maxCnt = 0;
  var maxKey;

  arr.forEach(function (val) {
    if (!counts[val]) {
      counts[val] = 0;
    }
    counts[val] += 1;
  });
  Object.keys(counts).forEach(function (key) {
    if (counts[key] > maxCnt) {
      maxCnt = counts[key];
      maxKey = key;
    }
  });
  return [maxKey, maxCnt];
};
