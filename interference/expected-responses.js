// calculates the number of domain requests for each ASN
var fs = require('fs');
var Q = require('q');
var asn = require('../asn_aggregation/asn_lookup');
var es = require('event-stream');

var resolverFile = process.argv[2];
var runDir = process.argv[3];
var asnTable = process.argv[4];
var outFile = process.argv[5];

var outFD = fs.openSync(outFile, 'wx');


function doASNs(domains, asnToResolver) {
  Object.keys(asnToResolver).forEach(function (asn) {
    var result = {
      asn: asn
    };

    domains.forEach(function (group) {
      var resolvers = Array.apply(null, new Array(group.length)).map(Number.prototype.valueOf, 0);

      asnToResolver[asn].forEach(function (resolver) {
        resolvers[resolver % group.length]++;
      });

      group.forEach(function (domain, idx) {
        result[domain] = resolvers[idx];
      });
    });

    fs.writeSync(outFD, JSON.stringify(result) + '\n');
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

        result[asn] = result[asn] || [];
        result[asn].push(new Buffer('243.123.231.4'.split('.')).readUInt32BE(0));
      }))
      .on('end', resolve.bind(undefined, result))
      .on('error', reject);
  });
}

Q.all([
  loadDomains(runDir),
  asn.getMap(asnTable).then(asnToResolver)
]).spread(doASNs)
  .then(console.log, console.error);