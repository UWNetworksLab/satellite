/*jslint node:true*/
'use strict';

var chalk = require('chalk');
var Q = require('q');
var fs = require('fs');
var stream = require('stream');
var progress = require('progressbar-stream');

var asn = require('../asn_aggregation/asn_lookup');
var liner = require('../util/liner').liner;

// Do ASN lookup on a one-ip-per-line file, and create 1 file per ASN with the
// IPs in that ASN.

exports.split = function (asnTable, file, out_dir) {
  return asn.getMap(asnTable).then(function (map) {
    console.log(chalk.blue('Reading ' + file));

    var input = fs.createReadStream(file),
      splitter = exports.makeSplitter(map, out_dir),
      total = 0;
    total = fs.statSync(file).size;

    return Q.Promise(function (resolve, reject) {
      input.pipe(progress({total: total})).pipe(liner).pipe(splitter);
      splitter.on('finish', function () {
        resolve(splitter);
      });
    });
  }).then(function (splitter) {
    console.log(chalk.blue('Writing Output.'));
    splitter.finish();
    console.log(chalk.green('done.'));
  }).catch(function (e) {
    console.dir(e);
  });
};

// A stream-splitter that stores data passed through it into a table, which it
// can subsubsequently write out to a directory.
exports.makeSplitter = function (map, out_dir) {
  var table = {},
    sink = new stream.Writable({ decodeStrings:false });

  sink.out_dir = out_dir;
  sink._write = function (line, encoding, done) {
    var asn = map.lookup(line);
    if (asn && asn !== 'ZZ') {
      if (!table[asn]) {
        table[asn] = [];
      }
      table[asn].push(line);
      if (table[asn].length > 1000) {
        this.flush_asn(asn);
      }
    }
    done();
  };

  sink.flush_asn = function (asn) {
    fs.appendFileSync(out_dir + '/' + asn + '.json', table[asn].join('\n'));
    table[asn] = [];
  };

  sink.finish = function () {
    var asns = Object.keys(table),
      i;
    asns.forEach(function (asn) {
      if (table[asn].length) {
        sink.flush_asn(asn);
        i += 1;
        if (i % 1000 === 0) {
          console.write(chalk.yellow('.'));
        }
      }
    });
    table = {};
  };

  return sink;
}
