var fs = require('fs');
var es = require('event-stream');
var countries = require('ip2country/src/as2country').createAS2CountryMap();
var progress = require('progressbar-stream');
var iputils = require('../util/ip_utils');

// Tells you which sites have too few resolutions across the different ASNs in a given country.
//
// usage: node extract_underflow.js <runs/date/asn.js> <blockedomains.json> <CountryCode>
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
   var n = 0; var m = 0;
  asns.forEach (function (asn) {
    if (!dom[asn]) {
      return;
    }
    Object.keys(dom[asn]).forEach(function (ip) {
      if(ip !== 'empty') {
        n += dom[asn][ip];
      } else {
        m += dom[asn][ip];
      }
    });
  });
  list.push([dom.name, n, m]);
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
      var sum = 0;    
      list.forEach(function(d) {
        sum += d[1] + d[2];
      });
      var avg = sum / list.length;
      var low = [];
      list.forEach(function(d) {
        if (d[1] < avg && d[2] > d[1]) {
          low.push([d[0], d[1], d[2]])
        }
      });
      fs.writeFileSync(process.argv[3], JSON.stringify(low));
      process.exit(0);
    });
});
