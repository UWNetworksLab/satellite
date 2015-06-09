'use strict';

/*
 * Collapse. From:
 * domain -> {resolver_asn -> {ip -> #resolutions}}
 * to:
 * resolver_country -> {domain -> {ip -> #resolutions}}
 */

var fs = require('fs');
var Q = require('q');
var chalk = require('chalk');
var es = require('event-stream');

if (!process.argv[3]) {
  console.error(chalk.red('Usage: pivot_domain-to-country-domain.js <ASN table> <asn-country-lookup> <out>'));
  process.exit(1);
}

var inFile = process.argv[2];
var lookupFile = process.argv[3];
var outFile = process.argv[4];
var outFD = fs.openSync(outFile, 'ax');
var tempDir = outFile + '-collapse-temp';

// Read one csv file line by line.
function reduceASN(file) {
  var into = {
    country: file.slice(file.length - 6, file.length - 4)
  };

  return Q.Promise(function (resolve, reject) {
    fs.createReadStream(file)
      .pipe(es.split())
      .pipe(es.mapSync(function (line) {
        var parts = line.toString('ascii').split(',');
        if (parts.length !== 3) {
          return;
        }
        var domain = parts[0], ip = parts[1], count = parseInt(parts[2]);
        into[domain] = into[domain] || {};
        into[domain][ip] = count;
      }))
      .on('end', resolve)
      .on('error', reject);
  }).then(function () {
    if (Object.keys(into).length > 1) {
      fs.writeSync(outFD, JSON.stringify(into) + '\n');
    }
    return true;
  });
}

function reduceAll(files) {
  console.log(chalk.blue("Starting Reduce Phase with %d ASNs"), files.length);
  return Q.Promise(function (resolve, reject) {
    var base = new Q(0);
    files.forEach(function (file) {
      base = base.then(reduceASN.bind({}, file));
    });
    return base.then(function () {
      console.log(chalk.green('Done.'));
      return files;
    }).then(resolve, reject);
  });
}

function mapDomain(allCSVs, lookup, outdir, line) {
  var country_ip_counts = {},
    asn_ip,
    domain;

  try {
    asn_ip = JSON.parse(line);
  } catch (e) {
    return;
  }
  domain = asn_ip.name;

  Object.keys(asn_ip).filter(function (asn) {
    return typeof asn_ip[asn] === 'object' && asn !== 'unknown' && lookup[asn];
  }).forEach(function (asn) {
    var country = lookup[asn];

    country_ip_counts[country] = country_ip_counts[country] || {};
    Object.keys(asn_ip[asn]).forEach(function (ip) {
      country_ip_counts[country][ip] = country_ip_counts[country][ip] || 0;
      country_ip_counts[country][ip] += asn_ip[asn][ip];
    });
  });

  Object.keys(country_ip_counts).forEach(function (country) {
    var records = Object.keys(country_ip_counts[country]).map(function (ip) {
      return domain + ',' + ip + ',' + country_ip_counts[country][ip];
    });

    if (records.length > 0) {
      var csv = outdir + '/' + country + '.csv';
      allCSVs[csv] = true;
      fs.appendFileSync(csv, records.join('\n') + '\n');
    }
  });
}

function mapAll(lookup) {
  var allCSVs = {};

  fs.mkdirSync(tempDir);

  console.log(chalk.blue('Starting Map Phase'));
  return Q.Promise(function (resolve, reject) {
    fs.createReadStream(inFile)
      .pipe(es.split())
      .pipe(es.mapSync(mapDomain.bind({}, allCSVs, lookup, tempDir)))
      .on('end', resolve)
      .on('error', reject);
  }).then(function () {
    console.log(chalk.green('Done.'));
    return Object.keys(allCSVs);
  });
}

function cleanUp(files) {
  console.log(chalk.blue("Cleaning up"));
  files.forEach(function (file) {
    fs.unlinkSync(file);
  });
  fs.rmdirSync(tempDir);
  console.log(chalk.green("Done."));
}

Q.nfcall(fs.readFile, lookupFile).then(JSON.parse).then(mapAll).then(reduceAll).then(cleanUp);
