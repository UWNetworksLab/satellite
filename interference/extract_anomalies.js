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
  var methods = sigs[dom.name];

  // Calculate sums for the quantities.
  Object.keys(asmap).forEach(function(country) {
    var countryTotal = 0;
    var countryGood = [];
    var countryStats = {
      "IP": {},
      "ASN": {},
      "PTR": {},
      "SERVER": {}
    };
    for (var i = 0; i < methods.length; i++) {
      countryGood.push(0);
    }
    asmap[country].forEach(function (asn) {
      if (!dom[asn]) {return;}
      Object.keys(dom[asn]).forEach(function (ip) {
        if (ip == "empty") {
          return;
        }
        countryTotal += dom[asn][ip];
        for (var i = 0; i < methods.length; i++) {
          var method = methods[i];
          if (method[0] == "IP") {
            if (method[1].indexOf(ip) > -1) {
              countryGood[i] += dom[asn][ip];
            }
            if (!countryStats.IP[ip]) {
              countryStats.IP[ip] = 0;
            }
            countryStats.IP[ip] += dom[asn][ip];
          } else if (method[0] == "ASN") {
            var c_asn = ip2asn.lookup(ip);
            if (method[1] == c_asn) {
              countryGood[i] += dom[asn][ip];
            }
            if (!countryStats.ASN[c_asn]) {
              countryStats.ASN[c_asn] = 0;
            }
            countryStats.ASN[c_asn] += dom[asn][ip];
          } else if (method[0] == "PTR") {
            var ptr = ptrs[ip];
            if (ptr && ptr[1].length && ptr[1][0].indexOf(".")) {
              ptr = ptr[1][0].split(".");
              // Account for '.co.uk' type things.
              if (ptr.length > 3 && ptr[ptr.length - 2].length < 3) {
                ptr = ptr[ptr.length - 3];
              } else {
                ptr = ptr[ptr.length - 2];
              }
              if (!countryStats.PTR[ptr]) {
                countryStats.PTR[ptr] = 0;
              }
              countryStats.PTR[ptr] += dom[asn][ip];
              if (ptr == method[1]) {
                countryGood[i] += dom[asn][ip];
              }
            }
          } else if (method[0] == "SERVER") {
            var server = servers[ip];
            if (server && server[1] < 500 && server[2].length) {
              if (!countryStats.SERVER[server[2]]) {
                countryStats.SERVER[server[2]] = 0;
              }
              countryStats.SERVER[server[2]] += dom[asn][ip];
              if (method[1] == server[2]) {
                countryGood[i] += dom[asn][ip];
              }
            }
          }
        }
      });
    });
    if (countryTotal > 20 && countryGood.length) {
      var j;
      for (j = 0; j < countryGood.length; j++) {
        if (countryGood[j] * 4 > countryTotal) {
          return;
        }
      }
      // failed.
      var out = [dom.name, countryTotal];
      for (j = 0; j < methods.length; j++) {
        if (methods[j][0] == "IP" && methods[j][1][0] == "empty") {
          return;
        }
        var top = Object.keys(countryStats[methods[j][0]]).sort(function(a, b) {
          return countryStats[methods[j][0]][b] - countryStats[methods[j][0]][a];
        })[0];
        out.push([methods[j][0], methods[j][1], countryGood[j], top, countryStats[methods[j][0]][top]]);
      }
      output[country].push(out);
    }
  });
};

// Remove domains which appear in more than half of countries.
var dedupe = function(countries) {
  var threshold = Object.keys(countries).filter(function(c) {
    return countries[c].length > 0;
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
  var filteredDomains = Object.keys(domainCounts).filter(function (dom) {
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
