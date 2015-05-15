// calculates the number of domain queries from each country
var fs = require('fs');
var Q = require('q');
var es = require('event-stream');
var ip2country = require('ip2country');

var resolverFile = process.argv[2];
var runDir = process.argv[3];
var outFile = process.argv[4];


function doDomains(domains, countryToResolver) {
  var result = {},
    memomize = {};

  domains.forEach(function (group) {
    var countryToRequests = memomize[group.length];

    if (!countryToRequests) {
      countryToRequests = {};
      Object.keys(countryToResolver).forEach(function (country) {
        var requests = Array.apply(null, new Array(group.length)).map(Number.prototype.valueOf, 0);
        countryToResolver[country].forEach(function (resolver) {
          requests[resolver % group.length]++;
        });
        countryToRequests[country] = requests;
      });
      memomize[group.length] = countryToRequests;
    }

    group.forEach(function (domain, idx) {
      var entry = {};

      Object.keys(countryToRequests).filter(function (country) {
        return countryToRequests[country][idx] > 0;
      }).forEach(function (country) {
        entry[country] = countryToRequests[country][idx];
      });

      result[domain] = entry;
    });
  });

  fs.writeFileSync(outFile, JSON.stringify(result));

  return 'Done.';
}

function loadDomains(directory) {
  return fs.readdirSync(directory)
    .filter(function (file) {
      return file.substring(file.length - 5, file.length) === '.json';
    }).map(function (file) {
      return JSON.parse(fs.readFileSync(directory + '/' + file));
    });
}

function countryToResolver() {
  return Q.Promise(function (resolve, reject) {
    var result = {};

    fs.createReadStream(resolverFile)
      .pipe(es.split())
      .pipe(es.mapSync(function (line) {
        var resolver, country;

        resolver = line.slice(0, line.length - 3);
        country = ip2country(resolver);

        if (country === 'ZZ' || line === '') {
          return;
        }

        result[country] = result[country] || [];
        result[country].push(new Buffer(resolver.split('.')).readUInt32BE(0));
      }))
      .on('end', function () {
        resolve(result);
      })
      .on('error', reject);
  });
}

Q.all([
  loadDomains(runDir),
  countryToResolver()
]).spread(doDomains)
  .then(console.log, console.error);