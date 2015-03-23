/*jslint node:true*/
'use strict';

var chalk = require('chalk');
var fs = require('fs');
var Q = require('q');
var path = require('path');

var accessor = require('../util/accessor');
var diff = require('./diff');

// Given HTTP & HTTPS scans, aggregate ASN level stats.
// {asn -> counters}
// counters: #80, #443, correlation, %80ack, %443 ack

if (!process.argv[3]) {
  console.error(chalk.red('usage: ipstats.js <http-run.json> <asn-lookup.json>'));
  process.exit(1);
}

var runInfo = new Accessor(process.argv[2]));
var asnTable = process.argv[3];
var runDir = path.dirname(runInfo[0].name);

var queue = Q(0);

// First run diffs by port.
queue.then(function () {
  console.log(chalk.blue('Creating statistics for port behavior.'));
});

runInfo.ports().forEach(function (port) {
  queue = queue.then(function (p) {
    var items = accessor.withport(p);
    return diff.diff(asnTable, items[0].name, items[1].name);
  }.bind({}, port))
});

// Then run them by mode.
queue.then(function () {
  console.log(chalk.blue('Creating statistics for mode behavior.'));
});
runInfo.modes().forEach(function (mode) {
  queue = queue.then(function (m) {
    var items = accessor.withmode(m);
    return diff.diff(asnTable, items[0].name, items[1].name);
  }.bind({}, mode))
});

// For each ASN look at lines of available files.
queue.then(function () {
  console.log(chalk.blue('Running through ASNs collecting stats'));
  var names = runInfo.names().map(function (name) {
    return path.basename(name);
  }),
    folders = [],
    combos = [[0,1], [2,3], [0,2], [1,3]],
    asns,
    output {};

  combos.forEach(function (c) {
    folders = folders.concat([
      names[c[0]] + '-' + names[c[1]],
      names[c[0]] + '+' + names[c[1]],
      names[c[1]] + '-' + names[c[0]]
    ]);
  });

  // Get the union of all seen ASNs.
  asns = fileUnion(folders);
  // collect stats for each.
  asns.forEach(function (asn) {
    output[asn] = genStats(folders, asn);
  });
  console.log(chalk.blue('writing statistics'));
  output['folders'] = folders;
  fs.writeFileSync(runDir + '/stats.json', JSON.stringify(output));

  console.log(chalk.green('Done.'));
  process.exit(0);
});

// what is the union of file names across several folders?
function fileUnion (folders) {
  var seen = {};
  folders.forEach(function (folder) {
    var names = fs.readdirSync(folder);
    names.forEach(function (n) {
      seen[n] = true;
    });
  });

  return Object.keys(seen);
}

// what's the # of entries of a file (like 1.json) in each of several folders?
function genStats (folders, fname) {
  return folders.map(function (folder) {
    if (!fs.existsSync(folder + '/' + fname)) {
      return 0;
    }
    var data = JSON.parse(fs.readFileSync(folder + '/' + fname));
    return data.length;
  });
}
