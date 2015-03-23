/*jslint node:true*/
'use strict';

var chalk = require('chalk');
var Q = require('q');
var stream = require('stream');

var asn = require('../asn_aggregation/asn_lookup');
var liner = require('../util/liner').liner;

// Do ASN lookup on a run, and create 1 file per ASN with the IPs returned
// within that ASN.

exports.split = function (asnTable, file, out_dir) {
  return asn.getMap(asnTable).then(function (map) {
    console.log(chalk.blue('Reading ' + file));

    var input = fs.createReadStream(file),
      spliter = exports.makeSplitter(map, out_dir);

    return Q.Promise(function (resolve, reject) {
      input.pipe(liner).pipe(splitter);
      splitter.on('finish', function () {
        resolve(splitter);
      });
    });
  }).then(function (splitter) {
    console.log(chalk.blue('Writing Output.'));
    splitter.finish();
    console.log(chalk.green('done.'));
  });
};

exports.makeSplitter = function (map, out_dir) {
  var table = {},
    watcher = new stream.Transform( { objectMode: true } );

  watcher._transform = function (line, encoding, done) {
    var asn = map.lookup(line);
    if (asn && asn ) {
      if (!table[asn]) {
        table[asn] = [];
      }
      table[asn].push(line);
    }
    done();
  }
  watcher.finish = function () {
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
