// Find the median number of distinct answer ASNs for a particular domain globally.
// Report all ASNs that gave a number larger than this median.

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
        var entry, sorted, median, stdev counts = {}, result = {};

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
              asns[asn] = true;
            }
          });
          counts[asn] = Object.keys(asns).length;
        });

        sorted = Object.keys(counts).sort(function (a, b) {
          return counts[a] - counts[b];
        };
        mean = stats.mean(sorted);
        stdev = stats.stdev(sorted);

        Object.keys(counts).filter(function (asn) {
          return counts[asn] > mean + 3 * stdev;
        }).forEach(function (asn) {
          result[asn] = counts[asn];
        });

        results[entry.name] = result;
      }))
      .on('end', resolve.bind({}, results))
      .on('error', reject);
  });
}

getMap(asnTable).then(doDomains).then(function(results) {
  fs.writeFileSync(outFile, JSON.stringify(results));
}).then(console.log, console.error);
