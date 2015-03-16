/*jslint node:true */
// Runs a bunch of overlapping zmap scans.
// args: <domain file> <dns servers file> <where to put output>
'use strict';

var fs = require('fs');
var Q = require('q');
var spawn = require('child_process').spawn;
var pkt = require('./mkpkt');
var conf = require('../util/config');

var zmapconf = conf.getKey('zmap').split(' ');

var run = function (run, host, domains) {
  var deferred = Q.defer(),
    i = 0,
    probe = [],
    zmap;
  for (i = 0; i < domains.length; i += 1) {
    pkt.make(domains[i], domains[i] + '.pkt');
    probe.push(domains[i] + '.pkt');
  }
  zmap = spawn(zmapconf[0], [
    '-p', '53',
    '-o',  run + '/' + domains[0] + '.csv',
    '-b', 'temp/blacklist.conf',
    '-w', host,
    '-c', 20,
    '-r', 50000,
    '--output-module=csv',
    '-f', 'saddr,timestamp-str,data',
    '--output-filter="success = 1 && repeat = 0"',
    '-M', 'udp-multi',
    '--probe-args=file:' + probe.join(',')
  ].concat(zmapconf.slice(1)), {
    stdio: ['ignore', 'pipe', process.stderr]
  });

  zmap.stdout.on('data', function (data) {
    console.log(data);
  });
  zmap.on('close', function () {
    deferred.resolve();
  });

  // Clean up.
  deferred.promise.then(function (file) {
    file.forEach(function (f) {
      try {
        fs.unlinkSync(f);
      } catch (e) {
        console.error(e.message);
      }
    });
  }.bind({}, probe));
  return deferred.promise;
};

var hosts = fs.readFileSync(process.argv[2]).toString().split('\n');
var perRun = conf.getKey("shards");

var doNext = function () {
  if (!hosts.length) {
    console.log('All Done.');
    process.exit(0);
    return;
  }
  
  var theseHosts = [],
    candidate;
  while (theseHosts.length < perRun && hosts.length) {
    candidate = hosts.shift();
    if (candidate && candidate.length && !fs.existsSync(run + '/' + candidate + '.csv')) {
      if (candidate.indexOf('/') > -1) {
        candidate = candidate.substr(0, candidate.indexOf('/'));
      }

      theseHosts.push(candidate);
    }
  }

  run(process.argv[4], process.argv[3], theseHosts).then(function () {
    setTimeout(doNext, 1000);
  });
};

doNext();

