'use strict';

/**
 * filter.js filters the initial cs.washington.edu.csv zmap scan to the set of
 * IPs that should be used for subsequent scans.
 *
 * Usage:
 * dns/filter.js <input.csv> <output.txt>
 * where:
 *   input.csv is the zmap output file, (csv of servers and base64 responses)
 *   ouput.txt is a return-separated list of ip/32's for use as a whitelist.
 *
 * Example usage:
 * node dns/filter.js runs/04-25-2015/cs.washington.edu.csv temp/hosts.txt
 */

var fs = require('fs'),
    stream = require('stream'),
    dns = require('native-dns-packet'),
    liner = require('../util/liner').liner,
    ip_utils = require('../util/ip_utils'),
    config = require('../util/config'),
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
  if (info.length !== 3) {
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

  if (record.header.qr === 0 || record.header.ra === 0 ) {
    done();
    return;
  }
  recursive += 1;

  if (record.answer.length === 0) {
    done();
    return;
  }
  answer += 1;

  var isvalid = false;
  for (var i = 0; i < record.answer.length; i += 1) {
    if (record.answer[i].address === config.get('local_ip') {
      isvalid = true;
      valid += 1;
      break;
    }
  }

  if (!isvalid || mask.get(ip_utils.getClassC(info[0])/256)) {
    done();
    return;
  }
  mask.set(ip_utils.getClassC(info[0])/256);
  dom += 1;

  this.push(info[0] + '/32\n');

  done();
};

input.pipe(liner).pipe(watcher).pipe(output);

output.on('finish', function() {
  printStats();
  process.exit(0);
});
