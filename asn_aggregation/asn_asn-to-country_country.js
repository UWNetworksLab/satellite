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
var countries = require('asbycountry');
var lookuper = require('ip2country/src/lookup');

if (!process.argv[3]) {
  console.error(chalk.red('Usage: asn_asn-to-country_country.js <lookup.json> <asn.json> <outfile>'));
  process.exit(1);
}

var asn_lookup = JSON.parse(fs.readFileSync(process.argv[2]));
var inFile = process.argv[3];
var outFile = process.argv[4];

var ip2asn = lookuper.lookup.bind({}, asn_lookup);

function doDomain(into, map, line) {
  var asn_info, domain, countrymap = {};
  try {
    asn_info = JSON.parse(line);
  } catch (e) {
    return;
  }
  domain = asn_info.name;
  if (!domain) {
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
  var invmap = {};
  Object.keys(countries).forEach(function (country) {
    countries[country].forEach(function (asn) {
      invmap[asn] = country;
    });
  });
  return Q.Promise(function (resolve, reject) {
    fs.createReadStream(inFile)
      .pipe(progress({total: total}))
      .pipe(es.split())
      .pipe(es.mapSync(doDomain.bind({}, into, invmap)))
      .pipe(es.join('\n'))
      .on('end', function () {
        resolve(into);
      })
      .on('error', reject);
  });
}

doAll().then(function (data) {
  console.log(chalk.blue('Writing Map.'));
  fs.writeFileSync(outFile, JSON.stringify(data));
});
