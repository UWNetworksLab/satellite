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
  console.error(chalk.red('Usage: asn_asn-to-country_country.js <infile> <outfile>'));
  process.exit(1);
}

var inFile = process.argv[2];
var outFile = process.argv[3];

function doDomain(into, map, line) {
  var asn_info, domain, countrymap = {};
  try {
    asn_info = JSON.parse(line);
  } catch (e) {
    return;
  }
  domain = asn_info[0];

  Object.keys(asn_info[1]).forEach(function(asn) {
    var cntry = map[asn];
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
    return Q.Promise(function (resolve, reject) {
    fs.createReadStream(inFile)
      .pipe(progress({total: total}))
      .pipe(es.split())
      .pipe(es.mapSync(doDomain.bind({}, into, map)))
      .pipe(es.join('\n'))
      .on('end', function () {
        resolve(into);
      })
      .on('error', reject);
  });
});
}

doAll().then(function (data) {
  fs.writeFileSync(outFile, JSON.stringify(data));
});
