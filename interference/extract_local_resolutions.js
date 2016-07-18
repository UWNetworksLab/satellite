var fs = require('fs');
var es = require('event-stream');
var asmap = require('asbycountry');
var progress = require('progressbar-stream');
var iputils = require('../util/ip_utils');

// Tells you which sites have a significant resolution to non-public prefixes
// within a given country.
//
// usage: node extract_local_resolutions.js <runs/date/asn.js> <output.json> <CountryCode>
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

var ASList = Array.from(new Set(asmap[country]));
var asnFile = process.argv[2];
var list = [];
fs.createReadStream(asnFile)
  .pipe(progress({total: fs.statSync(asnFile).size}))
  .pipe(es.split())
  .pipe(es.mapSync(doDomain.bind({}, ASList, list)))
  .on('end', function () {
    //console.log(list);
    fs.writeFileSync(process.argv[3], JSON.stringify(list));
    process.exit(0);
  });
