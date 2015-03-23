/*jslint node:true*/
'use strict';

/*
 * Aggregate a study by ASN#
 * Given an uncompressed study directory, the data is compressed to a denser mapping of
 * domain -> {asn -> {ip -> %}}
 */

var Q = require('q');
var fs = require('fs');
var es = require('event-stream');
var chalk = require('chalk');
var asn = require('../asn_aggregation/asn_lookup');
var dns = require('native-dns-packet');

if (!process.argv[4]) {
  console.error(chalk.red("Usage: asn_aggregator.js <rundir> <ASN table> <output file.>"));
  process.exit(1);
}
var rundir = process.argv[2];
var asnTable = process.argv[3];
var outFile = process.argv[4];
var outFD = fs.openSync(outFile, 'ax');


function parseDomainLine(map, into, domains, line) {
  var parts = line.toString('ascii').split(','),
    theasn,
    thedomain,
    record;
  if (parts.length !== 4) {
    return;
  }
  theasn = map.lookup(parts[0]);
  thedomain = domains[parseInt(parts[1], 10)];
  try {
    record = dns.parse(new Buffer(parts[2], 'hex'));
    if (!into[thedomain][theasn]) {
      into[thedomain][theasn] = {};
    }
    if (record.answer.length > 0) {
      record.answer.forEach(function (answer) {
        var ip = answer.address;
        if (!into[thedomain][theasn][ip]) {
          into[thedomain][theasn][ip] = 1;
        } else {
          into[thedomain][theasn][ip] += 1;
        }
      });
    } else {
      if (!into[thedomain][theasn].empty) {
        into[thedomain][theasn].empty = 0;
      }
      into[thedomain][theasn].empty += 1;
    }
  } catch (e) {
    into[thedomain].failed += 1;
    return;
  }
}

// Read one csv file line by line.
function collapseSingle(map, domains, file) {
  var into = {};
  domains.forEach(function (dom) {
    into[dom] = {
      name: dom,
      failed: 0
    };
  });
  if (fs.existsSync(rundir + '/' + file + '.asn.json')) {
    return new Q(0);
  }

  return Q.Promise(function (resolve, reject) {
    fs.createReadStream(rundir + '/' + file)
      .pipe(es.split())
      .pipe(es.mapSync(parseDomainLine.bind({}, map, into, domains)))
      .on('end', resolve)
      .on('error', reject);
  }).then(function (m) {
    var i;
    for (i = 0; i < domains.length; i += 1) {
      fs.writeSync(outFD, JSON.stringify(into[domains[i]]) + '\n');
      delete into[domains[i]];
    }
    return true;
  });
}

function collapseAll(asm) {
  var files = fs.readdirSync(rundir);
  console.log(chalk.blue("Starting Aggregation of %d files"), files.length);
  return Q.Promise(function (resolve, reject) {
    var base = new Q(0),
      n = 0,
      allFiles = [];
    files.forEach(function (file) {
      if (file.indexOf('.csv') < 0 || file.indexOf('asn.json') > 0 || !fs.existsSync(file.replace(".csv", ".json"))) {
        return;
      }
      allFiles.push(file);
      var domains = JSON.parse(fs.readFileSync(file.replace(".csv", ".json")));
      n += 1;
      if (n % 10 === 0) {
        base.then(function () {
          console.log(chalk.blue("."));
        });
      }
      if (n % 100 === 0) {
        base.then(function (x) {
          console.log(chalk.green(x));
        }.bind({}, n));
      }
      base = base.then(collapseSingle.bind({}, asm, domains, file));
    });
    return base.then(function () {
      console.log(chalk.green('Done.'));
      return allFiles;
    }).then(resolve, reject);
  });
}

asn.getMap(asnTable)
  .then(collapseAll)
  .then(function () {
    fs.closeSync(outFD);
    console.log(chalk.green('Done'));
    process.exit(0);
  }, function (err) {
    console.error(chalk.red(err));
  });
