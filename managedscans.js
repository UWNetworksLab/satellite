// Runs a bunch of overlapping zmap scans.
var fs = require('fs');
var Q = require('q');
var spawn = require('child_process').spawn;
var pkt = require('./mkpkt');

var threads = fs.readdirSync('hosts');
var re = /send: \d+ done/;

var run = function(run, host, domain) {
  var deferred = Q.defer();
  if (fs.existsSync('runs/' + run + '/' + domain + '.csv')) {
    deferred.resolve();
    return deferred.promise;
  }
  var probe = domain + '.pkt';
  pkt.make(domain, probe);
  var zmap = spawn('zmap', [
      '-p', '53',
      '-i', 'eth0',
      '-o', 'runs/' + run + '/' + domain + '.csv',
      '-b', 'blacklist.conf',
      '-w', host,
      '-c', 20,
      '-r', 50000,
      '--output-module=csv',
      '-f', 'saddr,timestamp-str,data',
      '--output-filter="success = 1 && repeat = 0"',
      '-M', 'udp',
      '--probe-args=file:' + probe
    ], {
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

var hosts = fs.readFileSync('domains.txt').toString().split('\n');
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
  // 45 second delay between starting.
  run(process.argv[2], 'hosts/' + threads[thread], host).then(setTimeout(doNext, 20000));
  thread = thread++;
  if (thread == threads.length) {
    thread = 0;
  }
};

doNext();

