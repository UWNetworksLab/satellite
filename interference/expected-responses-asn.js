// calculates the number of domain queries from each ASN
var fs = require('fs');
var Q = require('q');
var asn = require('../asn_aggregation/asn_lookup');
var es = require('event-stream');

var resolverFile = process.argv[2];
var runDir = process.argv[3];
var asnTable = process.argv[4];
var outFile = process.argv[5];
var outFD = fs.openSync(outFile, 'wx');


function doDomains(domains, asnToResolver) {
  var memomize = {};

  domains.forEach(function (group) {
    var asnToRequests = memomize[group.length];

    if (!asnToRequests) {
      asnToRequests = {};
      Object.keys(asnToResolver).forEach(function (asn) {
        var requests = Array.apply(null, new Array(group.length)).map(Number.prototype.valueOf, 0);
        asnToResolver[asn].forEach(function (resolver) {
          requests[resolver % group.length]++;
        });
        asnToRequests[asn] = requests;
      });
      memomize[group.length] = asnToRequests;
    }

    group.forEach(function (domain, idx) {
      var result = {
        name: domain
      };

      Object.keys(asnToRequests).filter(function (asn) {
        return asnToRequests[asn][idx] > 0;
      }).forEach(function (asn) {
        result[asn] = asnToRequests[asn][idx];
      });

      fs.writeSync(outFD, JSON.stringify(result) + '\n');
    });
  });

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

function asnToResolver(asm) {
  return Q.Promise(function (resolve, reject) {
    var result = {};

    fs.createReadStream(resolverFile)
      .pipe(es.split())
      .pipe(es.mapSync(function (line) {
        var resolver = line.slice(0, line.length - 3),
          asn = asm.lookup(resolver);

        if (line === '') {
          return;
        }

        result[asn] = result[asn] || [];
        result[asn].push(new Buffer(resolver.split('.')).readUInt32BE(0));
      }))
      .on('end', resolve.bind(undefined, result))
      .on('error', reject);
  });
}

Q.all([
  loadDomains(runDir),
  asn.getMap(asnTable).then(asnToResolver)
]).spread(doDomains)
  .then(console.log, console.error);