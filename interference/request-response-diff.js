var fs = require('fs');
var Q = require('q');
var es = require('event-stream');

if (!process.argv[4]) {
  console.error(chalk.red("Usage: request-response-diff.js <country-domain-ip> <expected-responses> <output-file>"));
  process.exit(1);
}

var countryFile = process.argv[2];
var expectedFile = process.argv[3];
var outFile = process.argv[4];


function getDiff(totals) {
  return Q.Promise(function (resolve, reject) {
    var averages = {},
      result = {},
      expected = JSON.parse(fs.readFileSync(expectedFile));

    // find average number of answers per request
    Object.keys(expected).forEach(function (domain) {
      var requests = Object.keys(expected[domain]).reduce(function (prev, country) {
        return prev + expected[domain][country];
      }, 0);
      averages[domain] = {
        answers: totals[domain].total / requests,
        empties: totals[domain].empty / requests
      };
    });


    fs.createReadStream(countryFile)
      .pipe(es.split())
      .pipe(es.mapSync(function (line) {
        var entry,
          country;

        if (line === '') {
          return;
        }

        entry = JSON.parse(line);
        country = entry.country;
        delete entry.country;

        result[country] = {};

        Object.keys(entry).forEach(function (domain) {
          var total, empty, expectedTotal, expectedEmpty;

          total = Object.keys(entry[domain]).reduce(function (prev, ip) {
            return prev + entry[domain][ip];
          }, 0);

          empty = entry[domain].empty || 0;

          expectedTotal = (averages[domain].answers * expected[domain][country]);
          expectedEmpty = (averages[domain].empties * expected[domain][country]);

          result[country][domain] = {
            total: (total - expectedTotal) / expectedTotal,
            empty: (empty - expectedEmpty) / expectedEmpty
          };
        });
      }))
      .on('end', function () {
        fs.writeFileSync(outFile, JSON.stringify(result));
        resolve('Done.');
      })
      .on('error', reject);
  });
}

// total number of answers received globally
function getTotals() {
  var result = {};

  return Q.Promise(function (resolve, reject) {
    fs.createReadStream(countryFile)
      .pipe(es.split())
      .pipe(es.mapSync(function (line) {
        var entry;

        if (line === '') {
          return;
        }

        entry = JSON.parse(line);
        Object.keys(entry).filter(function (key) {
          return key !== 'country';
        }).forEach(function (domain) {
          result[domain] = result[domain] || {
            total: 0,
            empty: 0
          };

          result[domain].empty += entry[domain].empty || 0;
          Object.keys(entry[domain]).forEach(function (ip) {
            result[domain].total += entry[domain][ip];
          });
        });
      }))
      .on('end', resolve.bind(undefined, result))
      .on('error', reject);
  });
}

getTotals().then(getDiff).then(console.log, console.error);