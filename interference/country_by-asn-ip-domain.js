// node ./country_by-asn-ip-domain.js asn-ip-domain.json sim-matrix-prefix as-country-lookup.js output.json [threshold]
//
// output {country: country,
//         asn: [{     ip: address,
//                domains: {domain: count},
//                  score: aggregate score over domains,
//                  total: total count over domains}}]
//
// Optional parameter [threshold] filters over aggregate score   (only sort of optional -- will run out of memory if this is to large)

var fs = require('fs');
var Q = require('q');
var chalk = require('chalk');
var es = require('event-stream');
var loadMatrix = require('../cluster_correlation/correlation-matrix.js').loadMatrixPromise;

var inFile = process.argv[2];
var matrixPrefix = process.argv[3];
var lookupFile = process.argv[4];
var outFile = process.argv[5];
var threshold = process.argv[6] || 1;


function flipLookup(lookup) {
  var result = {};

  Object.keys(lookup).forEach(function (key) {
    result[lookup[key]] = result[lookup[key]] || [];
    result[lookup[key]].push(key);
  });

  return result;
}

function groupByCountry(asn_domain_ip, lookup) {
  var result = {};

  Object.keys(lookup).filter(function (key) {
    return key !== 'ZZ';
  }).forEach(function (country) {
    result[country] = {};
    country.forEach(function (asn) {
      result[country][asn] = asn_domain_ip[asn];
    });
  });

  return result;
}

function scoreDomains(matrix, domains) {
  var totalOverlap = 0,
    score = 0;

  Object.keys(domains).forEach(function (a, i) {
    Object.keys(domains).slice(i + 1).forEach(function (b) {
      var overlap = Math.min(domains[a], domains[b]);

      totalOverlap += overlap;
      score += matrix.lookup(a, b) * overlap;
    });
  });

  return score / totalOverlap;
}

function doAsn(matrix, into, line) {
  var result = [],
    table;

  if (line === '') {
    return;
  }

  table = JSON.parse(line);

  Object.keys(table).filter(function (key) {
    return key !== 'asn';
  }).forEach(function (ip) {
    var entry, total, score;

    score = scoreDomains(matrix, table[ip]);
    if (score > threshold) {
      return;
    }

    total = Object.keys(table[ip]).reduce(function (prev, domain) {
      return prev + table[ip][domain];
    }, 0);

    entry = {
      ip: ip,
      domains: table[ip],
      score: score,
      total: total
    };

    result.push(entry);
  });

  result.sort(function (a, b) {
    return a.score - b.score;
  });

  into[table.asn] = result;
}

function doAll(matrix, lookup) {
  var into = {};

  console.log(chalk.blue('Scoring Countries'));
  return Q.Promise(function (resolve, reject) {
    fs.createReadStream(inFile)
      .pipe(es.split())
      .pipe(es.mapSync(doAsn.bind({}, matrix, into)))
      .on('end', resolve)
      .on('error', reject);
  }).then(function () {
    var country_asn_ip_count = groupByCountry(into, lookup);
    fs.writeFileSync(outFile, JSON.stringify(country_asn_ip_count));
    return chalk.green('Done.')
  });
}

Q.spread([
  loadMatrix(matrixPrefix),
  Q.nfcall(fs.readFile, lookupFile).then(JSON.parse).then(flipLookup)
], doAll).then(console.log, console.error);