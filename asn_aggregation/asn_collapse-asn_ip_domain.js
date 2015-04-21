/*
 * Collapse. From:
 * domain -> {resolver_asn -> {ip -> #resolutions}}
 * to:
 * resolver_asn -> {ip -> {domain -> #resolutions}}
 */

var fs = require('fs');
var Q = require('q');
var chalk = require('chalk');
var es = require('event-stream');

if (!process.argv[3]) {
  console.error(chalk.red('Usage: asn_collapse-asn_ip_domains.js <input file> <output directory>'));
  process.exit(1);
}

var inFile = process.argv[2];
var outFile = process.argv[3];
var outFD = fs.openSync(outFile, 'ax');
var tempDir = outFile + '-collapse-temp';

// Read one csv file line by line.
function reduceASN(file) {
  var into = {
    asn: parseInt(/(\d+)\.csv/.exec(file)[1])
  };

  return Q.Promise(function (resolve, reject) {
    fs.createReadStream(file)
      .pipe(es.split())
      .pipe(es.mapSync(function (line) {
        var parts = line.toString('ascii').split(',');
        if (parts.length !== 3) {
          return;
        }
        var ip = parts[0], domain = parts[1], count = parts[2];
        into[ip] = into[ip] || {};
        into[ip][domain] = parseInt(count);
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
    var base = Q(0);
    files.forEach(function (file) {
      base = base.then(reduceASN.bind({}, file));
    });
    return base.then(function () {
      console.log(chalk.green('Done.'));
      return files;
    }).then(resolve, reject);
  });
}

function mapDomain(allCSVs, outdir, line) {
  var asn_ip_domains = {},
    asn_ip,
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
    asn_ip_domains[asn] = [];

    Object.keys(asn_ip[asn]).filter(function (ip) {
      return ip !== 'empty' && ip !== 'undefined';
    }).forEach(function (ip) {
      asn_ip_domains[asn].push([ip, domain, asn_ip[asn][ip]]);
    });
  });

  Object.keys(asn_ip_domains).forEach(function (asn) {
    var records = asn_ip_domains[asn].map(function (record) {
      return record.join(',');
    });
    if (records.length > 0) {
      var csv = outdir + '/' + asn + '.csv';

      allCSVs[csv] = true;
      fs.appendFileSync(csv, records.join('\n') + '\n');
    }
  });
}

function mapAll() {
  var allCSVs = {};

  fs.mkdirSync(tempDir);

  console.log(chalk.blue('Starting Map Phase'));
  return Q.Promise(function (resolve, reject) {
    fs.createReadStream(inFile)
      .pipe(es.split())
      .pipe(es.mapSync(mapDomain.bind({}, allCSVs, tempDir)))
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

mapAll().then(reduceAll).then(cleanUp);