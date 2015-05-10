/*
 * Collapse. From:
 * {domain -> {asn -> {ip -> #resolutions}}}
 * to:
 * {ip -> {domain -> #resolutions}}  &&  {domain -> {ip -> #resolutions}}
 */

var fs = require('fs');
var Q = require('q');
var chalk = require('chalk');
var es = require('event-stream');
var progress = require('progressbar-stream');

if (!process.argv[4]) {
  console.error(chalk.red('Usage: asn_collapse-ip_domains.js <input file> <ip-domain out file> <domain-ip out file>'));
  process.exit(1);
}

var inFile = process.argv[2];
var outFile1 = process.argv[3];
var outFile2 = process.argv[4];


function doDomain(into, line) {
  var asn_ip,
    domain;

  try {
    asn_ip = JSON.parse(line);
  } catch (e) {
    return;
  }
  domain = asn_ip.name;

  Object.keys(asn_ip).filter(function (asn) {
    return typeof asn_ip[asn] === 'object' && asn !== 'unknown';
  }).forEach(function (asn) {
    Object.keys(asn_ip[asn]).filter(function (ip) {
      return ip !== 'empty' && ip !== 'undefined';
    }).filter(function (ip) {
      return ip.indexOf(':') < 0;
    }).forEach(function (ip) {
      into[ip] = into[ip] || {};
      into[ip][domain] = into[ip][domain] || 0;
      into[ip][domain] += asn_ip[asn][ip];
    });
  });
}

function doAll() {
  var total = fs.statSync(inFile).size || 0,
    into = {};

  console.log(chalk.blue('Starting'));
  return Q.Promise(function (resolve, reject) {
    fs.createReadStream(inFile)
      .pipe(progress({total: total}))
      .pipe(es.split())
      .pipe(es.mapSync(doDomain.bind({}, into)))
      .on('end', function () {
        console.log(chalk.green('Done.'));
        resolve(into);
      })
      .on('error', reject);
  });
}

function flipMap(table) {
  var result = {};

  Object.keys(table).forEach(function (ip) {
    Object.keys(table[ip]).forEach(function (domain) {
      result[domain] = result[domain] || {};
      result[domain][ip] = result[domain][ip] || 0;
      result[domain][ip] += table[ip][domain];
    });
  });

  return result;
}

doAll().then(function (result) {
  fs.writeFileSync(outFile1, JSON.stringify(result));
  fs.writeFileSync(outFile2, JSON.stringify(flipMap(result)));
});
