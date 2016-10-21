var fs = require('fs');
var es = require('event-stream');
var asmap = require('asbycountry');
var progress = require('progressbar-stream');
var iputils = require('../util/ip_utils');

// Tells you which IPs are used for block pages.
//
// usage: node extract_block_pages.js <runs/date/asn.js> <runs/date/reweight.json> <output.json> <cutoff>
var cutoff = process.argv[5] * 1.0;

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
  Object.keys(asns).forEach (function(country) {
    var worst, worstn = 0, good = 0, bad = 0;
    asns[country].forEach (function (asn) {
      if (!dom[asn]) {
        return;
      }
      Object.keys(dom[asn]).forEach(function (ip) {
        var score = domainScores[iputils.getClassC(ip)];
        if (score < cutoff) {
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
    if (bad > good) {
      if (!list[country][worst]) {
        list[country][worst] = [];
      }
      list[country][worst].push(dom.name);
    }
  });
}

console.log('Loading IP scores...');
var scores = JSON.parse(fs.readFileSync(process.argv[3]));
console.log('IP scores loaded.');

var asnFile = process.argv[2];
var list = {};
Object.keys(asmap).forEach(function(country) {
  list[country] = {};
});
fs.createReadStream(asnFile)
  .pipe(progress({total: fs.statSync(asnFile).size}))
  .pipe(es.split())
  .pipe(es.mapSync(doDomain.bind({}, asmap, scores, list)))
  .on('end', function () {
    //console.log(list);
    fs.writeFileSync(process.argv[4], JSON.stringify(list));
    process.exit(0);
  });
