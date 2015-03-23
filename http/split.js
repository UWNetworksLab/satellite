/*jslint node:true*/
'use strict';

var chalk = require('chalk');
var Q = require('q');
var stream = require('stream');

var asn = require('../asn_aggregation/asn_lookup');
var liner = require('../util/liner').liner;

// Do ASN lookup on a one-ip-per-line file, and create 1 file per ASN with the
// IPs in that ASN.

exports.split = function (asnTable, file, out_dir) {
  return asn.getMap(asnTable).then(function (map) {
    console.log(chalk.blue('Reading ' + file));

    var input = fs.createReadStream(file),
      spliter = exports.makeSplitter(map);

    return Q.Promise(function (resolve, reject) {
      input.pipe(liner).pipe(splitter);
      splitter.on('finish', function () {
        resolve(splitter);
      });
    });
  }).then(function (splitter) {
    console.log(chalk.blue('Writing Output.'));
    splitter.finish(out_dir);
    console.log(chalk.green('done.'));
  });
};

// A stream-splitter that stores data passed through it into a table, which it
// can subsubsequently write out to a directory.
exports.makeSplitter = function (map) {
  var table = {},
    watcher = new stream.Transform( { objectMode: true } );

  watcher._transform = function (line, encoding, done) {
    var asn = map.lookup(line);
    if (asn && asn !== 'ZZ') {
      if (!table[asn]) {
        table[asn] = [];
      }
      table[asn].push(line);
    }
    done();
  }
  watcher.get = function (asn) {
    if (!asn) {
      return table;
    }
    return table[asn];
  };
  watcher.finish = function (out_dir) {
    var asns = Object.keys(table),
      i;
    asns.forEach(function (asn) {
      fs.writeFileSync(out_dir + '/' + asn + '.json', JSON.stringify(table[asn]));
      i += 1;
      if (i % 100 === 0) {
        console.write(chalk.yellow('.'));
      }
    });
    table = {};
  };

  return watcher;
}
