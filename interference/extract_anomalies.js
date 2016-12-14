/*
 * Extracts a list of potentially inacessible domains for each country with
 * a reasonable number of measurements. Anomalies are considered to be cases
 * where the bulk of resolutions within a country don't conform to the expected
 * behavior of a domain, as found in `cluster_correlation/domain_signature.js`.
 */
// usage: node extract_anomalies.js <asn.json> <signatures.json> <lookup.json> <ptrs.json> <servers.json> <output.json>

var asmap = require('asbycountry');
var chalk = require('chalk');
var es = require('event-stream');
var fs = require('fs');
var ip2country = require('ip2country');
var progress = require('progressbar-stream');
var jsonlinesloader = require('../util/jsonlinesloader');

var a_asn = process.argv[2];
var a_sigs = process.argv[3];
var a_lookup = process.argv[4];
var a_ptrs = process.argv[5];
var a_servers = process.argv[6];
var a_output = process.argv[7];

// Load lookup tables:
var ip2asn = JSON.parse(fs.readFileSync(a_lookup));
var sigs = JSON.parse(fs.readFileSync(a_sigs));
ip2asn.lookup = ip2country.lookup.bind({}, ip2asn);
var ptrs = jsonlinesloader.load(a_ptrs);
var servers = jsonlinesloader.load(a_servers);

var checkSignature = function(output, domLine) {
  if (!domLine.length) {
    return;
  }
  var dom;
  try {
    dom = JSON.parse(domLine);
  } catch (e) {
    return;
  }
  if (!dom.name) {
    return;
  }
  var method = sigs[dom.name];

  // Calculate sums for the quantities.
  Object.keys(asmap).forEach(function(country) {
    var countryTotal = 0;
    var countryGood = 0;
    asmap[country].forEach(function (asn) {
      if (!dom[asn]) {return;}
      Object.keys(dom[asn]).forEach(function (ip) {
        if (ip == "empty") {
          return;
        }
        countryTotal += dom[asn][ip];
        if (method[0] == "IP") {
          if (method[1].indexOf(ip) > -1) {
            countryGood += dom[asn][ip];
          }
        } else if (method[0] == "ASN") {
          if (method[1] === ip2asn.lookup(ip)) {
            countryGood += dom[asn][ip];
          }
        } else if (method[0] == "PTR") {
          var ptr = ptrs[ip];
          if (ptr && ptr[1].length && ptr[1][0].indexOf(".")) {
            ptr = ptr[1][0].split(".");
            ptr = ptr[ptr.length - 2];
            if (ptr === method[1]) {
              countryGood += dom[asn][ip];
            }
          }
        } else if (method[0] == "SERVER") {
          var server = servers[ip];
          if (server && server[1] < 500 && server[2].length && method[1] === server[2]) {
            countryGood += dom[asn][ip];
          }
        }
      });
    });
    if (countryTotal > 20 && method[0] !== "UNKNOWN" && countryGood * 4 < countryTotal) {
      output[country].push([dom.name, method[0], countryGood / countryTotal]);
    }
  });
};

// Remove domains which appear in more than half of countries.
var dedupe = function(countries) {
  var threshold = Object.keys(countries).filter(function(c) {
    return countries[c].lenght > 0;
  }).length / 2;

  // Tally.
  var domainCounts = {};
  Object.keys(countries).forEach(function(c) {
    countries[c].forEach(function (dom) {
      if (!domainCounts[dom[0]]) {
        domainCounts[dom[0]] = 0;
      }
      domainCounts[dom[0]] += 1;
    })
  });

  // Get Bad Domains.
  var filteredDomains = Object.Keys(domainCounts).filter(function (dom) {
    return domainCounts[dom] > threshold;
  });
  console.log(chalk.blue("Ignoring " + filteredDomains.length +
      " domains which were anomalous everywhere."));

  // Remove.
  Object.keys(countries).forEach(function (c) {
    countries[c] = countries[c].filter(function(domline) {
      return filteredDomains.indexOf(domline[0]) == -1;
    });
  });
};

// Parse each domain.
var list = {};
Object.keys(asmap).forEach(function(country) {
  list[country] = [];
});
fs.createReadStream(a_asn)
  .pipe(progress({total: fs.statSync(a_asn).size}))
  .pipe(es.split())
  .pipe(es.mapSync(checkSignature.bind({}, list)))
  .on('end', function () {
    dedupe(list);
    //console.log(list);
    fs.writeFileSync(a_output, JSON.stringify(list));
    process.exit(0);
  });
