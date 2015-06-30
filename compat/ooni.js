/*jslint node:true*/
'use strict';

/*
 * write ooni header & footer.
 * usage: node ooni.js <date> <ooni.json.header> <ooni.json.footer>
 */

var fs = require('fs');
var chalk = require('chalk');

var version = JSON.parse(fs.readFileSync(__dirname + '/../package.json')).version;
var localip = require('../util/config').getKey('local_ip');

var ooniHFD = fs.createWriteStream(process.argv[3]);
var ooniFFD = fs.createWriteStream(process.argv[4]);
var rid = new Date(process.argv[2]).toISOString() + "-satellite";

ooniHFD.write(new Buffer(JSON.stringify({
  "software_name": "satellite",
  "software_version": version,
  "probe_asn": "AS73",
  "probe_cc": "US",
  "probe_ip": localip,
  "record_type": "header",
  "report_id": rid,
  "start_time": new Date(process.argv[2]).valueOf() / 1000,
  "test_name": "dns",
  "test_version": "1.0.0",
}) + '\n'));

ooniFFD.write(new Buffer(JSON.stringify({
  "software_name": "satellite",
  "software_version": version,
  "probe_asn": "AS73",
  "probe_cc": "US",
  "probe_ip": localip,
  "record_type": "footer",
  "report_id": rid,
  "start_time": new Date().valueOf() / 1000,
  "test_name": "dns",
  "test_version": "1.0.0",
}) + '\n'));

ooniHFD.end();
ooniFFD.end();
