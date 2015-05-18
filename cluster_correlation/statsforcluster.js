// Get stats (ASNs, Countries, #IPs) for a cluster of domains.

var fs = require('fs');
var chalk = require('chalk');
var ip2country = require('ip2country');
var iputil = require('../util/ip_utils');
var add = function (a, b) { return a + b; };

var getData = function (domains, scores, lookup, threshold) {
return lookup.then(function (map) {
  console.log(chalk.blue('Files Loaded.'));
  var ips = {};
  domains.forEach(function (dom) {
    if (!dom) { return; }
    Object.keys(scores[dom]).forEach(function (ip) {
      if (!ips[ip]) {
        ips[ip] = [];
      }
      ips[ip].push(scores[dom][ip]);
    });
  });
  console.log(chalk.blue(Object.keys(ips).length) + chalk.yellow(' IPs under consideration'));
  var goodIPs = [];
  var goodScores = [];

  Object.keys(ips).forEach(function (ip) {
    var thold = eval(threshold.replace('n', ips[ip].length));
    var score = ips[ip].reduce(add, 0);
    if (score > thold) {
      goodIPs.push(ip);
      goodScores.push(score);
    }
  });
  console.log(chalk.blue(goodIPs.length) + chalk.yellow(' In Cluster.'))

  var ASNs = {}, countries = {};
  goodIPs.forEach(function (ip) {
    var asn = map.lookup(Number(ip));
    var country = ip2country(Number(ip))
    ASNs[asn] = true;
    countries[country] = true;
  });
  ASNs = Object.keys(ASNs);
  console.log(chalk.blue(ASNs.length) + chalk.yellow(' ASNs.'));

  countries = Object.keys(countries);
  console.log(chalk.blue(countries.length) + chalk.yellow(' Countries.'));

  return {
    ips: goodIPs.map(iputil.format),
    scores: goodScores,
    asns: ASNs,
    countries: countries
  };
}).catch(function (e) {
  console.error(e);
});
};

exports.getData = getData;

// statsforcluster.js <domains.txt> <scores> <asntable> [threshold]

if (process.argv.length >= 5) {
  var domains = fs.readFileSync(process.argv[2]).toString().split('\n');
  var scores = JSON.parse(fs.readFileSync(process.argv[3]));
  var lookup = require('../asn_aggregation/asn_lookup').getMap(process.argv[4]);
  getData(domains, scores, lookup, process.argv[5] || '1');
}
