var fs = require('fs');
var es = require('event-stream');
var asmap = require('asbycountry');
var chalk = require('chalk');
var progress = require('progressbar-stream');
var iputils = require('../util/ip_utils');
var ip2country = require('ip2country');

// Tells you which IPs are used for block pages.
//
// usage: node extract_block_pages.js <runs/date/asn.js> <runs/date/lookup.json> <output.json>
var doDomain = function (asns, scores, list, maxglobals, domLine) {
  if (!domLine.length) {
    return;
  }
  var dom;
  try {
    dom = JSON.parse(domLine);
  } catch (e) {
    return;
  }
  // 1. calcuate global IP distribution.
  var ipcnts = {};
  var totalcnt = 0;
  Object.keys(dom).forEach(function (asn) {
    if (asn == "name") {
      return;
    }
    Object.keys(dom[asn]).forEach(function(ip) {
      if (!ipcnts[ip]) {
        ipcnts[ip] = 0;
      }
      ipcnts[ip] += dom[asn][ip];
      totalcnt += dom[asn][ip];
    });
  });

  // 2. Calculate how divergent responses are (how spread out are resolutions?)
  var maxcnt = 0;
  var maxip = null;
  Object.keys(ipcnts).forEach(function (ip) {
    if (ipcnts[ip] > maxcnt) {
      maxcnt = ipcnts[ip];
      maxip = ip;
    }
  });
  var leeway = totalcnt / maxcnt;
  maxglobals[dom.name] = maxip;

  // 3. calculate per-country IP distributions.
  Object.keys(asns).forEach(function(country) {
    var cntryipcnts = {};
    var cntrytotalcnt = 0;
    asns[country].forEach(function (asn) {
      if (!dom[asn]) {
        return;
      }
      Object.keys(dom[asn]).forEach(function (ip) {
        if (!cntryipcnts[ip]) {
          cntryipcnts[ip] = 0;
        }
        cntryipcnts[ip] += dom[asn][ip];
        cntrytotalcnt += dom[asn][ip];
      });
    });

    // 3b. what fraction of IPs are not found outside of the country?
    Object.keys(cntryipcnts).forEach(function (ip) {
      // only care about the head.
      if (cntryipcnts[ip] / cntrytotalcnt < 0.1) {
        return;
      }

      if (cntryipcnts[ip] / ipcnts[ip] > leeway * cntrytotalcnt / totalcnt) {
        if (!iputils.isReserved(ip) && ipasMap.lookup(ip) != "ZZ" && ipasMap.lookup(ip) != country) {
          return;
        }

        if (!list[country][ip]) {
          list[country][ip] = [];
        }
        list[country][ip].push(dom.name);
      }
    });
  });
};

var asnFile = process.argv[2];
var list = {};
var maxglobals = {};
Object.keys(asmap).forEach(function(country) {
  list[country] = {};
});

var ipasMap = JSON.parse(fs.readFileSync(process.argv[3]));
ipasMap.lookup = ip2country.lookup.bind({}, ipasMap);

console.log(chalk.blue("Calculating country-specific IPs per domain."));
fs.createReadStream(asnFile)
  .pipe(progress({total: fs.statSync(asnFile).size}))
  .pipe(es.split())
  .pipe(es.mapSync(doDomain.bind({}, asmap, list, maxglobals)))
  .on('end', function () {
    // 3. find IPs with low ratio across domains.
    console.log(chalk.blue("Correlating IPs across domains."));
    var output = {};
    Object.keys(list).forEach(function (country) {
      output[country] = [];
      Object.keys(list[country]).forEach(function (ip) {
        if (list[country][ip].length > 5) {
          var correlated = 0;
          for (var i = 0; i < list[country][ip].length; i++) {
            for (var j = i + 1; j < list[country][ip].length; j++) {
                if (maxglobals[list[country][ip][i]] == maxglobals[list[country][ip][j]]) {
                  correlated += 1;
                }
            }
          }
          if (correlated < list[country][ip].length) {
            output[country].push([ip, doms]);
          }
        }
      });
    });
    console.log(chalk.green("Writing Output."));
    fs.writeFileSync(process.argv[4], JSON.stringify(output));
    process.exit(0);
  });
