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
  console.error(chalk.red("Usage: asn_aggregator.js <rundir> <ASN table> <output file>"));
  process.exit(1);
}
var rundir = process.argv[2];
var asnTable = process.argv[3];
var outFile = process.argv[4];
var outFD = fs.openSync(outFile, 'ax');


function parseDomainLine(map, blacklist, into, domains, line) {
  var parts = line.toString('ascii').split(','),
    theasn,
    thedomain,
    record;
  if (parts.length !== 4 || blacklist[parts[0]]) {
    return;
  }
  thedomain = domains[parseInt(parts[1], 10)];
  if (thedomain === undefined) {
    return;
  }
  theasn = map.lookup(parts[0]);
  if (theasn === 'ZZ') {
    theasn = 'unknown';
  }
  try {
    record = dns.parse(new Buffer(parts[3], 'hex'));
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
  }
}

// Read one csv file line by line.
function collapseSingle(map, blacklist, domains, file) {
  var into = {};
  domains.forEach(function (dom) {
    into[dom] = {
      name: dom,
      failed: 0
    };
  });

  return Q.Promise(function (resolve, reject) {
    fs.createReadStream(rundir + '/' + file)
      .pipe(es.split())
      .pipe(es.mapSync(parseDomainLine.bind({}, map, blacklist, into, domains)))
      .on('end', resolve)
      .on('error', reject);
  }).then(function () {
    var i;
    for (i = 0; i < domains.length; i += 1) {
      fs.writeSync(outFD, JSON.stringify(into[domains[i]]) + '\n');
      delete into[domains[i]];
    }
    return true;
  });
}

function collapseAll(asm, blacklist) {
  var files = fs.readdirSync(rundir);
  console.log(chalk.blue("Starting Aggregation of %d files"), files.length);
  return Q.Promise(function (resolve, reject) {
    var base = new Q(0),
      n = 0,
      allFiles = [];
    files.forEach(function (file) {
      if (file.indexOf('.csv') < 0 || !fs.existsSync(rundir + '/' + file.replace('.csv', '.json'))) {
        return;
      }
      allFiles.push(file);
      var domains = JSON.parse(fs.readFileSync(rundir + '/' + file.replace('.csv', '.json')));
      n += 1;
      if (n % 10 === 0) {
        base.then(function () {
          console.log(chalk.blue('.'));
        });
      }
      if (n % 100 === 0) {
        base.then(function (x) {
          console.log(chalk.green(x));
        }.bind({}, n));
      }
      base = base.then(collapseSingle.bind({}, asm, blacklist, domains, file));
    });
    return base.then(function () {
      console.log(chalk.green('Done.'));
      return allFiles;
    }).then(resolve, reject);
  });
}

function parseBlackList(into, line) {
  var parts = line.split(','),
    record;
  if (parts.length == 3) {
    try {
      record = dns.parse(new Buffer(parts[2], 'hex'));
    } catch (e) {
      return;
    }
    if (record.header.ra == 1 && record.answer.length > 0 && record.answer[0].address !== '128.208.3.200') {
      into[parts[0]] = true;
    }
  }
}

function getBlackList(filename) {
  return Q.Promise(function (resolve, reject) {
    var into = {};
    console.log(chalk.blue("Generating Server Filter List"));
    fs.createReadStream(rundir + '/' + filename)
      .pipe(es.split())
      .pipe(es.mapSync(parseBlacklistLine.bind({}, into)))
      .on('end', function () {
        console.log(chalk.green('Done.'));
        resolve(into);
      })
      .on('error', reject);
  });
}

Q.spread([asn.getMap(asnTable), getBlackList('cs.washington.edu.csv')], collapseAll)
  .then(function () {
    fs.closeSync(outFD);
    console.log(chalk.green('Done'));
    process.exit(0);
  }, function (err) {
    console.error(chalk.red(err));
  });
