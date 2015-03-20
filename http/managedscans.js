/*jslint node:true*/
'use strict';

// Run syn and syn-ack scans on 80 and 443.
// usage: node managedscans.js <run directory>

var fs = require('fs');
var Q = require('q');
var spawn = require('child_process').spawn;
var conf = require('../util/config');

var zmapconf = conf.getKey('zmap').split(' ');

var run = function (args) {
  console.log('Beginning ' + args.mode + ' scan on port ' + args.port);
  var deferred = Q.defer(),
    zmap = spawn(zmapconf[0], [
      '-p', args.port,
      '-o', args.name,
      '-b', 'temp/blacklist.conf',
      '-c', 300,
      '-r', conf.getKey('rate'),
      '--output-module=csv',
      '-f', 'saddr',
      '-M', args.mode
    ].concat(zmapconf.slice(1)), {
      stdio: ['ignore', 'pipe', process.stderr]
    });

  zmap.on('close', function () {
    deferred.resolve();
  });

  return deferred.promise;
};

var mk = function (dir, port, mode) {
  return {
    name: dir + '/' + port + '-' + mode + '.csv',
    port: port,
    mode: mode
  };
};

var objects = [
  mk(process.argv[2], 80, 'tcp_synscan'),
  mk(process.argv[2], 80, 'tcp_ackscan'),
  mk(process.argv[2], 443, 'tcp_synscan'),
  mk(process.argv[2], 443, 'tcp_ackscan')
];

run(objects[0]).then(function () {
  return run(objects[1]);
}).then(function () {
  return run(objects[2]);
}).then(function () {
  return run(objects[3]);
}).then(function () {
  fs.writeFileSync(process.argv[2] + '/http-scan.json', JSON.stringify(objects));
  console.log('Done');
  process.exit(0);
});
