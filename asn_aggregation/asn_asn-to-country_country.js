'use strict';

/*
 * Collapse. From:
 * {domain -> {asn -> {ip -> #resolutions}}}
 *
 * To:
 * <outprefix>.asn-asn.json :  {domain -> {asn -> dominant asn}}
 */

var fs = require('fs');
var Q = require('q');
var chalk = require('chalk');
var es = require('event-stream');
var progress = require('progressbar-stream');
var countries = require('ip2country/src/as2country').createAS2CountryMap();

if (!process.argv[3]) {
  console.error(chalk.red('Usage: asn_asn-to-country_country.js <domains.txt> <asn.json> <outfile>'));
  process.exit(1);
}

var domains = process.argv[2];
var inFile = process.argv[3];
var outFile = process.argv[4];

function doDomain(into, map, line, domains) {
  var asn_info, domain, countrymap = {};
  var domain = domains.shift();
  try {
    asn_info = JSON.parse(line);
  } catch (e) {
    return;
  }
  Object.keys(asn_info).forEach(function(asn) {
    var cntry = map[asn];
    if (!cntry) {
      return;
    }
    countrymap[cntry] = countrymap[cntry] || {};
    Object.keys(asn_info[1][asn]).forEach(function (dest) {
      var destcntry = map[dest];
      countrymap[cntry][destcntry] = countrymap[cntry][destcntry] || 0;
      countrymap[cntry][destcntry] += asn_info[1][asn][dest];
    });
  });

  into[domain] = countrymap;
}

function doAll() {
  var total = fs.statSync(inFile).size || 0,
    into = {};

  console.log(chalk.blue('Starting'));
  return countries.then(function(map) {
    var dlines = fs.readFileSync(domains).split('\n');

    return Q.Promise(function (resolve, reject) {
    fs.createReadStream(inFile)
      .pipe(progress({total: total}))
      .pipe(es.split())
      .pipe(es.mapSync(doDomain.bind({}, into, map, dlines)))
      .pipe(es.join('\n'))
      .on('end', function () {
        resolve(into);
      })
      .on('error', reject);
  });
});
}

doAll().then(function (data) {
  console.log(chalk.blue('Writing Map.'));
  fs.writeFileSync(outFile, JSON.stringify(data));
});
