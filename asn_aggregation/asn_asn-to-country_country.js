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
var lookuper = require('ip2country/src/lookup');

if (!process.argv[3]) {
  console.error(chalk.red('Usage: asn_asn-to-country_country.js <lookup.json> <domains.txt> <asn.json> <outfile>'));
  process.exit(1);
}

var asn_lookup = JSON.parse(fs.readFileSync(process.argv[2]));
var domains = process.argv[3];
var inFile = process.argv[4];
var outFile = process.argv[5];

var ip2asn = lookuper.lookup.bind({}, asn_lookup);

function doDomain(into, map, domains, line) {
  var asn_info, domain, countrymap = {};
  domain = domains.shift();
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
    Object.keys(asn_info[asn]).forEach(function (dest) {
      var destasn = ip2asn(dest),
          destcntry = map[destasn];
      countrymap[cntry][destcntry] = countrymap[cntry][destcntry] || 0;
      countrymap[cntry][destcntry] += asn_info[asn][dest];
    });
  });

  into[domain] = countrymap;
}

function doAll() {
  var total = fs.statSync(inFile).size || 0,
    into = {};

  console.log(chalk.blue('Starting'));
  return countries.then(function(map) {
    var dlines = fs.readFileSync(domains).toString().split('\n');

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
