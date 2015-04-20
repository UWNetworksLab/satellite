/*
 * Aggregate a study by ASN#
 * Given an uncompressed study directory, the data is compressed to a denser mapping of
 * domain -> {asn -> {ip -> %}}
 */

var Q = require('q');
var fs = require('fs');
var es = require('event-stream');
var chalk = require('chalk');
var asn = require('./asn_aggregation/asn_lookup');
var dns = require('native-dns-packet');
var ProgressBar = require('progress');
var progressBarStream = require('progressbar-stream');

if (!process.argv[4]) {
  console.error(chalk.red("Usage: asn_aggregator.js <rundir> <ASN table> <output file.>"));
  process.exit(1);
}
var rundir = process.argv[2];
var asnTable = process.argv[3];
var outFile = process.argv[4];
var outFD = fs.openSync(outFile, 'ax');


function parseDomainLine(map, blacklist, into, line) {
  var parts = line.toString('ascii').split(','),
    theasn, record, answers;

  if (parts.length !== 3 || blacklist[parts[0]]) {
    return;
  }

  theasn = map.lookup(parts[0]);
  if (theasn === 'ZZ') {
    theasn = 'unknown';
  }

  try {
    record = dns.parse(new Buffer(parts[2], 'hex'));
    if (record.question.length != 1 || record.question[0].name !== into.name) {
      return; // misfiled response
    }

    answers = record.answer.filter(function (answer) {
      return answer.type === dns.consts.NAME_TO_QTYPE.A;
    });

    into[theasn] = into[theasn] || {};
    if (answers.length > 0) {
      answers.forEach(function (answer) {
        var ip = answer.address;
        into[theasn][ip] = into[theasn][ip] || 0;
        into[theasn][ip] += 1;
      });
    } else {
      into[theasn].empty = into[theasn].empty || 0;
      into[theasn].empty += 1;
    }
  } catch (e) {
    into.failed += 1;
  }
}

// Read one csv file line by line.
function collapseSingle(map, blacklist, file) {
  return Q.Promise(function (resolve, reject) {
    var into = {
      name: file.replace(/\.csv/, ''),
      failed: 0
    };

    fs.createReadStream(rundir + '/' + file)
      .pipe(es.split())
      .pipe(es.mapSync(parseDomainLine.bind({}, map, blacklist, into)))
      .on('end', resolve.bind({}, into))
      .on('error', reject);
  }).then(function (out) {
    fs.writeSync(outFD, JSON.stringify(out) + '\n');
    return true;
  });
}

function collapseAll(asm, blacklist) {
  var base = Q(),
    files, bar;

  files = fs.readdirSync(rundir).filter(function (file) {
    return /\.csv$/.test(file);
  });
  console.log(chalk.blue("Starting Aggregation of %d domains"), files.length);
  bar = new ProgressBar(':bar :percent :eta', {total: files.length});

  files.forEach(function (file) {
    base = base.then(collapseSingle.bind({}, asm, blacklist, file)).then(function () {
      bar.tick();
    });
  });

  return base;
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
    var into = {},
      total = fs.statSync(rundir + '/' + filename).size;

    console.log(chalk.blue("Generating Server Filter List"));
    fs.createReadStream(rundir + '/' + filename)
      .pipe(progressBarStream({total: total}))
      .pipe(es.split())
      .pipe(es.mapSync(parseBlackList.bind({}, into)))
      .on('end', resolve.bind({}, into))
      .on('error', reject);
  });
}

Q.spread([asn.getMap(asnTable), getBlackList('cs.washington.edu.csv')], collapseAll)
  .then(function () {
    fs.closeSync(outFD);
    process.exit(0);
  }, function (err) {
    console.error(chalk.red(err));
  });
