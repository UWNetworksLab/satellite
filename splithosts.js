// Usage: node splitHosts.js <n>
// Splits hosts.txt into n parts.

var partitions = process.argv[2];
console.log("Splitting/Filtering Hosts into " , partitions, " parts");

// Read in.
var hosts = fs.readFileSync("hosts.txt").toString().split("\n");

// Allocate n buckets.
var buckets = [];
for (var i = 0; i < partitions; i++) {
  buckets[i] = [];
}

// Create bloom filter for filtering at /24's.
var bloom = new require('bloomfilter')(256 * 256 * 256, 8);
var adds = 0;

// Shuffle into buckets.
for (var i = 0; i < hosts.length; i++) {
  var prefix = hosts[i].substr(0, hosts[i].lastIndexOf('.'));
  if (!bloom.test(prefix)) {
    buckets[Math.floor(Math.random()*partitions)].push(hosts[i]);
    bloom.add(prefix);
    adds += 1;
  }
}

// Mkdir if not there
if (!fs.existsSync("hosts")) {
  fs.mkdirSync("hosts");
}

// Write out.
for (var i = 0; i < partitions; i++) {
  var data = buckets[i].join('\n');
  fs.writeFileSync('hosts/hosts-' + i + '.txt', data);
}

console.log("Done. Filtered to ", adds, " of ", hosts.length);
process.exit(0);
