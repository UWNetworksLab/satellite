// Input: zmap output file (.csv of servers and base64 packets)
// Output: Return separated list of ip/32 with a functional recursive server.
//
// Used, for example, to filter out IPs that look like they're actually DNS
// servers from the initial zmap scan.

var fs = require('fs'),
    readline = require('readline'),
    stream = require('stream'),
    dns = require('native-dns-packet'),
    liner = require('../util/liner').liner,
    ip_utils = require('../util/ip_utils'),
    mask = require('../util/mask').newMask(256*256*256);


var hosts = 0, recursive = 0, answer = 0, dom = 0, valid = 0;

function printStats() {
  console.log("total=" + hosts + ", recursive bit=" + recursive + ", with answer field=" + answer +
      ", valid answers=" + valid + ", distinct /24s=" + dom);
}

var input = fs.createReadStream(process.argv[2]);
var output = fs.createWriteStream(process.argv[3]);

var watcher = new stream.Transform( { objectMode: true } );
watcher._transform = function (line, encoding, done) {
  var info = line.split(','),
      record;
  if (info.length != 3) {
    done();
    return;
  }
  hosts += 1;
  try {
    record = dns.parse(new Buffer(info[2], 'hex'));
  } catch(e) {
    done();
    return;
  }
  
  if (record.header.qr == 0 || record.header.ra == 0 ) {
    done();
    return;
  }
  recursive += 1;

  if (record.answer.length == 0) {
    done();
    return;
  }
  answer += 1;

  if (record.answer[0].address == '128.208.3.200') {
    valid += 1;
  }

  if (mask.get(ip_utils.getClassC(info[0]))) {
    done();
    return;
  }
  mask.set(ip_utils.getClassC(info[0]))
  dom += 1;

  this.push(info[0] + '/32\n');

  done();
};

input.pipe(liner).pipe(watcher).pipe(output);

output.on('finish', function() {
  printStats();
  process.exit(0);
}); 
