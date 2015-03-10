// Input: zmap output file (.csv of servers and base64 packets)
// Output: Return separated list of ip/32 with a functional recursive server.

var fs = require('fs'),
  readline = require('readline'),
  stream = require('stream'),
  dns = require('native-dns-packet'),
  liner = require('../util/liner').liner;

var input = fs.createReadStream(process.argv[2]);
var output = fs.createWriteStream(process.argv[3]);

var watcher = new stream.Transform({
  objectMode: true
});
watcher._transform = function(line, encoding, done) {
  var info = line.split(','),
    record;
  if (info.length != 3) {
    done();
    return;
  }

  try {
    record = dns.parse(new Buffer(info[2], 'hex'));
  } catch (e) {
    done();
    return;
  }

  if (record.header.qr == 1 && (record.answer.length == 0 || record.answer[0].address !== '128.208.3.200')) {
    this.push(info[0] + '\n');
  }

  done();
};

input.pipe(liner).pipe(watcher).pipe(output);

output.on('finish', function() {
  process.exit(0);
});