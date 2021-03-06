/*jslint node:true*/
// Usage: node splitHosts.js <file> <directory> <n>
// Splits file, a list of ips, into n parts. In the process, filter down to a single server
// in each /24 (e.g. if multiple servers in a single /24 exist, we'll only take
// one of them.

var fs = require('fs');
var source_file = process.argv[2];
var dest_dir = process.argv[3];
var partitions = process.argv[4];
console.log("Splitting/Filtering Hosts into ", partitions, " parts");
if (!partitions) {
  process.exit(1);
}

// Read in.
var hosts = fs.readFileSync(source_file).toString().split("\n");

// Allocate n buckets.
var buckets = [], i;
for (i = 0; i < partitions; i += 1) {
  buckets[i] = [];
}

// Create bloom filter for filtering at /24's.
var BloomFilter = require('bloomfilter').BloomFilter;
var bloom = new BloomFilter(256 * 256 * 256, 8);
var adds = 0;

// Shuffle into buckets.
for (i = 0; i < hosts.length; i += 1) {
  var prefix = hosts[i].substr(0, hosts[i].lastIndexOf('.'));
  if (!bloom.test(prefix)) {
    buckets[Math.floor(Math.random() * partitions)].push(hosts[i]);
    bloom.add(prefix);
    adds += 1;
  }
}

// Mkdir if not there
if (!fs.existsSync(dest_dir)) {
  fs.mkdirSync(dest_dir);
}

// Write out.
for (i = 0; i < partitions; i += 1) {
  var data = buckets[i].join('\n');
  fs.writeFileSync(dest_dir + '/hosts-' + i + '.txt', data);
}

console.log("Done. Filtered to ", adds, " of ", hosts.length);
process.exit(0);
