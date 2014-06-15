var fs = require('fs'),
    readline = require('readline'),
    stream = require('stream'),
    dns = require('native-dns-packet');
    

var hosts = 0, recursive = 0, answer = 0, valid = 0;

function printStats() {
  console.log("l=" + hosts + ", r=" + recursive + ", a=" + answer +
      ", v=" + valid);
}

var input = fs.createReadStream(process.argv[2]);
var output = fs.createWriteStream(process.argv[3]);

var rl = readline.createInterface({
    input: input,
    output: output,
    terminal: false
});

rl.on('line', function(line) {
  var info = line.split(','),
      record;
  if (info.length != 3) {
    return;
  }
  hosts += 1;
  try {
    record = dns.parse(new Buffer(info[2], 'hex'));
  } catch(e) {
    return;
  }
  
  if (record.header.qr == 0 || record.header.ra == 0 ) {
    return;
  }

  recursive += 1;

  output.write(info[0] + '\n');

  if (record.answer.length == 0) {
    return;
  }
  answer += 1;

  if (record.answer[0].address == '128.208.3.200') {
    valid += 1;
  }
});

rl.on('close', function() {
  printStats();
  output.end();
  output.on('finish', function() {
    process.exit(0);
  }); 
});