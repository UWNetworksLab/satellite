var fs = require('fs');
var es = require('event-stream');
var asmap = require('asbycountry');
var progress = require('progressbar-stream');
var iputils = require('../util/ip_utils');

// Tells you which sites have too few resolutions across the different ASNs
//
// usage: node extract_underflow.js <runs/date/asn.js> <output.json>

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
  Object.keys(asns).forEach (function (country) {
    var n = 0; var m = 0;
    asns[country].forEach(function (asn) {
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
    list[country].push([dom.name, n, m]);
  });
}

var asnFile = process.argv[2];
var list = {};
Object.keys(asmap).forEach(function(country) {
  list[country] = [];
});

fs.createReadStream(asnFile)
//  .pipe(progress({total: fs.statSync(asnFile).size}))
  .pipe(es.split())
  .pipe(es.mapSync(doDomain.bind({}, asmap, list)))
  .on('end', function () {
    //console.log(list);
    var downs = {};
    Object.keys(list).forEach(function (country) {
      var sum = 0;
      list[country].forEach(function(d) {
        sum += d[1] + d[2];
      });
      var avg = sum / list[country].length;
      var low = [];
      list[country].forEach(function(d) {
        // < 50% success
        if (d[1] < avg && d[2] > d[1]) {
          low.push([d[0], d[1], d[2]])
        }
      });
      downs[country] = low;
    });
    fs.writeFileSync(process.argv[3], JSON.stringify(downs));
    process.exit(0);
  });
