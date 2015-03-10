// Runs a bunch of overlapping zmap scans.
// args: <domain file> <folder of ips> <where to put output>
var fs = require('fs');
var Q = require('q');
var spawn = require('child_process').spawn;
var pkt = require('./mkpkt');
var conf = require('../util/config');

var threads = fs.readdirSync(process.argv[3]);
var re = /send: \d+ done/;
var zmap = conf.getKey('zmap').split(' ');

var run = function(run, host, domain) {
  var deferred = Q.defer();
  if (fs.existsSync(run + '/' + domain + '.csv')) {
    deferred.resolve();
    return deferred.promise;
  }
  var probe = domain + '.pkt';
  pkt.make(domain, probe);
  var zmap = spawn(zmap[0], [
      '-p', '53',
      '-o',  run + '/' + domain + '.csv',
      '-b', 'temp/blacklist.conf',
      '-w', host,
      '-c', 20,
      '-r', 50000,
      '--output-module=csv',
      '-f', 'saddr,timestamp-str,data',
      '--output-filter="success = 1 && repeat = 0"',
      '-M', 'udp',
      '--probe-args=file:' + probe
    ].concat(zmap.slice(1)), {
      stdio: ['ignore', 'pipe', process.stderr]
    });

  zmap.stdout.on('data', function (data) {
    if (data && data.length && data.match && data.match(re)) {
      deferred.resolve();
    }
    console.log(data);
  });
  zmap.on('close', function() {
    deferred.resolve();
  });

  // Clean up.
  deferred.promise.then(function(file) {
    try {
      fs.unlinkSync(file);
    } catch(e) {
      console.error(e.message);
    }
  }.bind({}, probe));
  return deferred.promise;
}

var hosts = fs.readFileSync(process.argv[2]).toString().split('\n');
var thread = 0;
var doNext = function() {
  if (!hosts.length) {
    // wait 5 minutes to exit so that the run is done
    setTimeout(function() {
      process.exit(0)
    }, 60 * 1000)
    return;
  }
  var host = hosts.shift();
  if (!host || !host.length) {
    return doNext();
  }
  if (host.indexOf('/') > -1) {
    host = host.substr(0, host.indexOf('/'));
  }
  // 45 second delay between starting.
  run(process.argv[4], process.argv[3] + '/' + threads[thread], host).then(setTimeout(doNext, 20000));
  thread = thread++;
  if (thread == threads.length) {
    thread = 0;
  }
};

doNext();

