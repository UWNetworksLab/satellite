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

