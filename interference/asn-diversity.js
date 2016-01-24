// Find the median number of distinct answer ASNs for a particular domain globally.
// Report all ASNs that gave a number larger than this median.
'use strict';

var fs = require('fs');
var es = require('event-stream');
var Q = require('q');
var getMap = require('../asn_aggregation/asn_lookup.js').getMap;
var stats = require('stats-lite');

//Usage: asn-diversity.js <domain-asn-ip> <.lookup.json> <output>
var aggregation = process.argv[2];
var asnTable = process.argv[3];
var outFile = process.argv[4];


function doDomains(asm) {
  var results = {};

  return Q.Promise(function (resolve, reject) {
    fs.createReadStream(aggregation)
      .pipe(es.split())
      .pipe(es.mapSync(function (line) {
        var entry, sorted, median, mean, stdev, counts = {},statcounts={}, result = {};

        if (line === '' || line === 'undefined') {
          return;
        }

        entry = JSON.parse(line);

        Object.keys(entry).filter(function (key) {
          return key !== 'name' && key !== 'failed';
        }).forEach(function (asn) {
          var asns = {};
          Object.keys(entry[asn]).filter(function (answer) {
            return answer !== 'empty';
          }).forEach(function (answer) {
            var asn = asm.lookup(answer);
            if (answer !== 'unknown') {
              if (!asns[asn]) {asns[asn] =0;}
              asns[asn] += 1;
            }
          });
          var max = 0, total = 0;
          Object.keys(asns).forEach(function (asn) {
            total += asns[asn];
            if (asns[asn] > max) {
              max = asns[asn];
            }
          });
          counts[asn] = total/max;
          if (total >= 20) {
            statcounts[asn] = total/max;
          }
        });

        sorted = Object.keys(counts).map(function(asn) {
          return counts[asn];
	}).sort(function (a, b) {
          return counts[a] - counts[b];
        });
        mean = stats.mean(sorted);
        stdev = stats.stdev(sorted);

        Object.keys(statcounts).filter(function (asn) {
          return statcounts[asn] > mean + 3 * stdev;
        }).forEach(function (asn) {
          result[asn] = statcounts[asn];
        });

        if (Object.keys(result).length > 0) {
          results[entry.name] = result;
        }
      }))
      .on('end', resolve.bind({}, results))
      .on('error', reject);
  });
}

getMap(asnTable).then(doDomains).then(function(results) {
  fs.writeFileSync(outFile, JSON.stringify(results));
}).then(console.log, console.error);
