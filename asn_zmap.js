/*
 * Aggregate zmap output to ASN# counts.
 * from a csv of IP addresses, you get a denser count of
 * ASN# -> #
 */

var Q = require('q');
var fs = require('fs');
var es = require('event-stream')
var chalk = require('chalk')
var asn = require('./asn_aggregation/asn_lookup')

var infile = process.argv[2];
if (!infile) {
  console.error(chalk.red("Input file must be specified."));
  process.exit(1);
}
if (!process.argv[3]) {
  console.error(chalk.red("Output file must be specified."));
  process.exit(1);
}

function addLine(map, into, line) {
  var theasn = map.lookup(parts[0].trim());
  if (!into[theasn]) {
    into[theasn] = 0;
  }
  into[theasn] += 1;
}

function dealWithFile(map, infile, outfile) {
  var into = {};
  return Q.Promise(function(resolve, reject) {
    fs.createReadStream(infile)
      .pipe(es.split())
      .pipe(es.mapSync(addLine.bind({}, map, into)))
      .on('end', resolve)
      .on('error', reject);
  }).then(function(m) {
    fs.writeFileSync(outfile, JSON.stringify(into));
    delete into;
    return true;
  });
}

asn.getMap().then(function (map) {
  return dealWithFile(map, infile, outfile);
}).then(function() {
  console.log(chalk.green('Done'));
  process.exit(0);
});
