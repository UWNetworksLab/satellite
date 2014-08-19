// Input: zmap output file (.csv of servers and base64 packets).
// Output: .json of received packet info.
var util = require('util');
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

var input = fs.createReadStream(process.argv[2]);
var output = fs.createWriteStream(process.argv[3]);

var resultsList = [];

var toJsonWithJustIPs = new stream.Transform( { objectMode: true } );
toJsonWithJustIPs._transform = function (line, encoding, done) {
  var info = line.split(','),
      record;
  if (info.length != 3) {
    done();
    return;
  }
  try {
    record = dns.parse(new Buffer(info[2], 'hex'));
  } catch(e) {
    done();
    return;
  }

  if (!record.answer) {
    done();
    return;
  }
  if (record.answer.length === 0) {
    done();
    return;
  }

  for (var i=0; i<record.answer.length; i++) {
    var row = {
      'server_ip': info[0],
      'timestamp': info[1],
      'answer': record.answer[i].address,
      'domain': record.answer[i].name,
      'ttl': record.answer[i].ttl,
      'type': record.answer[i].type,
      'class': record.answer[i]['class']
    }
    this.push(JSON.stringify(row) + '\n');
  }

  done();
};

input.pipe(liner).pipe(toJsonWithJustIPs).pipe(output);


output.on('finish', function() {
  process.exit(0);
}); 
