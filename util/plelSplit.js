/*jslint node:true*/
'use strict';
// usage: plelSplit.js $processes $indir $outprefix $cmd
// Runs $processes#'s of $cmd
// starts by taking a directory, partioning files in it into several parts,
// running the $cmd on each subdirectory, outputing to files
// then cleans stuff back up to how it was.

var Q = require('q');
var fs = require('fs');
var glob = require('glob');
var chalk = require('chalk');
var path = require('path');
var spawn = require('child_process').spawn;

if (!process.argv[5]) {
  console.error(chalk.red("Usage: plelsplit.js <parallelism> <inputdir> <outputprefix> <cmd>"));
  process.exit(1);
}
var degree = Number(process.argv[2]);
var indir = process.argv[3];
var outprefix = process.argv[4];
var cmd = process.argv[5];

var files = glob.sync(indir + '/*.csv');

for (var i = 0; i < degree; i += 1) {
  try {
    fs.mkdirSync(indir + '/part_' + i);
  } catch (e) {
    if (e.code !== 'EEXIST') {
      throw e;
    }
  }
}
for (var i = 0; i < files.length; i += 1) {
  var filename = path.basename(files[i]);
  fs.renameSync(files[i], indir + '/part_' + (i % degree) + '/' + filename);
  // also do corresponding jsons.
  var json = files[i].replace('.csv', '.json');
  fs.renameSync(json, indir + '/part_' + (i % degree) + '/' + path.basename(json));
}

// run.
var subprocesses = [];
for (var i = 0; i < degree; i += 1) {
  var deferred = Q.defer(),
    pcess,
    parts = cmd.replace('#1', indir + '/part_' + i).replace('#2', outprefix + '.' + i).split(' ');
  pcess = spawn(parts[0], parts.slice(1), {
    stdio: ['ignore', 'pipe', process.stderr]
  });

  pcess.on('close', deferred.resolve);

  subprocesses.push(deferred.promise);
}
Q.all(subprocesses).then(function cleanup() {
  // move back.
  var i;
  for (i = 0; i < files.length; i += 1) {
    var filename = path.basename(files[i]);
    fs.renameSync(indir + '/part_' + (i % degree) + '/' + filename, files[i]);
    // also do corresponding jsons.
    var json = files[i].replace('.csv', '.json');
    fs.renameSync(indir + '/part_' + (i % degree) + '/' + path.basename(json), json);
  }
  for (i = 0; i < degree; i += 1) {
    fs.rmdirSync(indir + '/part_' + i);
  }
}).catch(function (e) {
  console.warn(chalk.red('Error in aggregation:'), e);
});
