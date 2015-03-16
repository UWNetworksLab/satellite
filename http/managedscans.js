/*jslint node:true*/
'use strict';

// Run syn and syn-ack scans on 80 and 443.
// usage: node managedscans.js <run directory>

var fs = require('fs');
var Q = require('q');
var spawn = require('child_process').spawn;
var pkt = require('./mkpkt');
var conf = require('../util/config');

var zmapconf = conf.getKey('zmap').split(' ');

var run = function (run, port, mode) {
  console.log('Beginning ' + mode + ' scan on port ' + port);
  var deferred = Q.defer(),
    zmap = spawn(zmapconf[0], [
      '-p', port,
      '-o', run + '/' + port + '-' + mode + '.csv',
      '-b', 'temp/blacklist.conf',
      '-c', 300,
      '-r', 200000,
      '--output-module=csv',
      '-f', 'saddr',
      '-M', mode
    ].concat(zmapconf.slice(1)), {
      stdio: ['ignore', 'pipe', process.stderr]
    });

  zmap.on('close', function () {
    deferred.resolve();
  });

  return deferred.promise;
};

run(process.argv[2], 80, 'tcp_ackscan').then(function () {
  return run(process.argv[2], 443, 'tcp_ackscan');
}).then(function () {
  return run(process.argv[2], 80, 'tcp_synscan');
}).then(function () {
  return run(process.argv[2], 443, 'tcp_synscan');
}).then(function () {
  console.log('Done');
  process.exit(0);
});
