var fs = require('fs');
var es = require('event-stream');
var asmap = require('asbycountry');
var progress = require('progressbar-stream');
var iputils = require('../util/ip_utils');

// Tells you which IPs are used for block pages in a country.
//
// usage: node extract_block_pages.js <runs/date/asn.js> <runs/date/reweight.json> <output.json> <CountryCode>
var country = process.argv[5];

var doDomain = function (asns, scores, list, domLine) {
  if (!domLine.length) {
    return;
  }
  var dom;
  try {
    dom = JSON.parse(domLine);
  } catch (e) {
    return;
  }
  var domainScores = scores[dom.name];
  var worst, worstn = 0, good = 0, bad = 0;
  asns.forEach (function (asn) {
    if (!dom[asn]) {
      return;
    }
    Object.keys(dom[asn]).forEach(function (ip) {
      var score = domainScores[iputils.getClassC(ip)];
      if (score < 0) {
        bad += dom[asn][ip];
        if (dom[asn][ip] > worstn) {
          worst = ip;
          worstn = dom[asn][ip];
        }
      } else {
        good += dom[asn][ip];
      }
    });
  });
  if (bad * 4 > good) {
    if (!list[worst]) {
      list[worst] = 0;
    }
    list[worst] += 1;
  }
}

var ASList = Array.from(new Set(asmap[country]));
console.log('Loading IP scores...');
var scores = JSON.parse(fs.readFileSync(process.argv[3]));
console.log('IP scores loaded.');

var asnFile = process.argv[2];
var list = {};
fs.createReadStream(asnFile)
  .pipe(progress({total: fs.statSync(asnFile).size}))
  .pipe(es.split())
  .pipe(es.mapSync(doDomain.bind({}, ASList, scores, list)))
  .on('end', function () {
    //console.log(list);
    fs.writeFileSync(process.argv[4], JSON.stringify(list));
    process.exit(0);
  });
