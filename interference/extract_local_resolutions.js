var fs = require('fs');
var es = require('event-stream');
var countries = require('ip2country/src/as2country').createAS2CountryMap();
var progress = require('progressbar-stream');
var iputils = require('../util/ip_utils');

// Tells you which sites have a significant resolution to a specific prefix
// across the different ASNs in a given country.
// A sufficient script to extract sites blocked to a known block-page IP address
//
// usage: node get_blocks.js <runs/date/asn.js> <blockedomains.json> <CountryCode>
var country = process.argv[4];

var doDomain = function (asns, list, domLine) {
  if (!domLine.length) {
    return;
  }
  var dom;
  try {
    dom = JSON.parse(domLine);
  } catch (e) {
    return;
  }
  var good = 0, bad = 0;
  asns.forEach (function (asn) {
    if (!dom[asn]) {
      return;
    }
    Object.keys(dom[asn]).forEach(function (ip) {
      if (iputils.isReserved(ip)) {
        bad += dom[asn][ip];
      } else {
        good += dom[asn][ip];
      }
    });
  });
  if (bad * 4 > good) {
    //console.log(dom.name);
    list.push([dom.name, good, bad]);
  }
}

countries.then (function (cmap) {
  var irASNs = [];
  Object.keys(cmap).forEach(function (asn) {
    if (cmap[asn] === country) {
      irASNs.push(asn);
    }
  });
  var asnFile = process.argv[2];
  var list = [];
  fs.createReadStream(asnFile)
    .pipe(progress({total: fs.statSync(asnFile).size}))
    .pipe(es.split())
    .pipe(es.mapSync(doDomain.bind({}, irASNs, list)))
    .on('end', function () {
      //console.log(list);
      fs.writeFileSync(process.argv[3], JSON.stringify(list));
      process.exit(0);
    });
});
