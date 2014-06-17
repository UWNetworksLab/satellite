var fs = require('fs'),
    readline = require('readline'),
    stream = require('stream'),
    dns = require('native-dns-packet');
    

/** Line chunker from http://strongloop.com/strongblog/practical-examples-of-the-new-node-js-streams-api/ */
var liner = new stream.Transform( { objectMode: true } )

liner._transform = function (chunk, encoding, done) {
     var data = chunk.toString()
     if (this._lastLineData) data = this._lastLineData + data

     var lines = data.split('\n')
     this._lastLineData = lines.splice(lines.length-1,1)[0]

     lines.forEach(this.push.bind(this))
     done()
}

liner._flush = function (done) {
     if (this._lastLineData) this.push(this._lastLineData)
     this._lastLineData = null
     done()
}
/** end line chunker */


var hosts = 0, recursive = 0, answer = 0, valid = 0;

function printStats() {
  console.log("l=" + hosts + ", r=" + recursive + ", a=" + answer +
      ", v=" + valid);
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

  this.push(info[0] + '\n');

  if (record.answer.length == 0) {
    done();
    return;
  }
  answer += 1;

  if (record.answer[0].address == '128.208.3.200') {
    valid += 1;
  }

  done();
};

input.pipe(liner).pipe(watcher).pipe(output);

output.on('finish', function() {
  printStats();
  process.exit(0);
}); 
