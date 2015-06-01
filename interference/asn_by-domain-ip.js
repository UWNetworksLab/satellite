// node ./asn_by-domain-ips.js asn-domain-ip.json scores.json output.json [threshold]
//
// output {asn: asn,
//         domain -> {ips: {ip: [count, score]},
//                    score: aggregate score over IPs,
//                    total: total count over IPs}}
//
// Optional parameter [threshold] filters over aggregate score

var fs = require('fs');
var Q = require('q');
var chalk = require('chalk');
var es = require('event-stream');

var inFile = process.argv[2];
var scoresFile = process.argv[3];
var outFile = process.argv[4];
var threshold = process.argv[5] || 1;
var outFD = fs.openSync(outFile, 'ax');

function doAsn(scores, line) {
  var result,
    table;

  if (line === '') {
    return;
  }

  table = JSON.parse(line);
  result = {asn: table.asn};
  delete table.asn;

  Object.keys(table).forEach(function (domain) {
    var totalScore = 0,
      totalCount = 0,
      entry;

    entry = {ips: {}};
    Object.keys(table[domain]).filter(function (key) {
      return key !== 'empty';
    }).forEach(function (ip) {
      var count = table[domain][ip],
        score = scores[domain][ip];

      entry.ips[ip] = [count, score];

      totalScore += score * count;
      totalCount += count;
    });

    totalScore /= totalCount;
    if (totalScore <= threshold) {
      entry.score = totalScore;
      entry.total = totalCount;
      result[domain] = entry;
    }
  });

  fs.writeSync(outFD, JSON.stringify(result) + '\n');
}

function doAll(scores) {
  console.log(chalk.blue('Scoring Countries'));
  return Q.Promise(function (resolve, reject) {
    fs.createReadStream(inFile)
      .pipe(es.split())
      .pipe(es.mapSync(doAsn.bind({}, scores)))
      .on('end', resolve)
      .on('error', reject);
  }).then(function () {
    return chalk.green('Done.')
  });
}

Q.nfcall(fs.readFile, scoresFile).then(JSON.parse).then(doAll).then(console.log, console.error);
