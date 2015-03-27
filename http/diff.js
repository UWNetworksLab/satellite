/*jslint node:true*/
'use strict';

var chalk = require('chalk');
var fs = require('fs');
var path = require('path');

var splitter = require('./split');

// From a pair of scans, calculate intersection & partials.
exports.diff = function (asnInfo, file_a, file_b) {
  if (path.dirname(file_a) !== path.dirname(file_b)) {
    console.warn(chalk.yellow('Diff attempted with files in different places!' +
        ' Diff output will be placed in: ' + path.dirname(file_a)));
  }
  var out_dir = path.dirname(file_a),
    name_a = path.basename(file_a),
    name_b = path.basename(file_b),
    dir_a = file_a + '.byasn',
    dir_b = file_b + '.byasn';

  // Strategy:
  // Split each file if not already, then run alg for each ASN.
  fs.mkdirSync(out_dir + '/' + name_a + '+' + name_b);
  fs.mkdirSync(out_dir + '/' + name_a + '-' + name_b);
  fs.mkdirSync(out_dir + '/' + name_b + '-' + name_a);

  var ret = Q(0);

  if (!fs.existsSync(dir_a)) {
    fs.mkdirSync(dir_a);
    ret = ret.then(function () {
      return splitter.split(asnInfo, file_a, dir_a);
    });
  }
  if (!fs.existsSync(dir_b)) {
    fs.mkdirSync(dir_b);
    ret = ret.then(function () {
      return splitter.split(asnInfo, file_b, dir_b);
    });
  }
  return ret.then(function () {
    // Get asns & run sorted walk.
    var asns_a = fs.readdirSync(dir_a),
      asns_b = fs.readdirSync(dir_b),
      i = 0, asni,
      j = 0, asnj;
    while (i < asns_a.length && j < asns_b.length) {
      asn_i = asns_a[i], asn_j = asns_b[j];
      if ((asn_i < asn_j && i < asns_a.length) || j === asns_b.length) {
        exports.diffASN(
          dir_a + '/' + asn_i,
          name_a,
          undefined,
          name_b,
          asn_i,
          out_dir
        );
        i += 1;
      } else if (asn_i == asn_j) {
        exports.diffASN(
          dir_a + '/' + asn_i,
          name_a,
          dir_b + '/' + asn_j,
          name_b,
          asn_i,
          out_dir
        );
        i += 1;
        j += 1;
      } else { // asn_i > asn_j
        exports.diffASN(
          undefined,
          name_a,
          dir_b + '/' + asn_j,
          name_b,
          asn_j,
          out_dir
        );
        j += 1;
      }
    }
  });
};

/// For pair of ips in an ASN, calculate intersection & partials
exports.diffASN = function (file_a, name_a, file_b, name_b, asn, out_dir) {
  var ips_a = [],
    ips_b = [],
    ips_both = [],
    ips_aonly = [],
    ips_bonly = [];

  if (fs.existsSync(file_a)) {
    ips_a = JSON.parse(fs.readFileSync(file_a));
  }
  if (fs.existsSync(file_b)) {
    ips_b = JSON.parse(fs.readFileSync(file_b));
  }

  ips_a.forEach(function (ip) {
    if (ips_b.indexOf(ip) > -1) {
      ips_both.push(ip);
    } else {
      ips_aonly.push(ip);
    }
  });
  ips_b.forEach(function (ip) {
    if (ips_both.indexOf(ip) < -1) {
      ips_bonly.push(ip);
    }
  });

  fs.writeFileSync(JSON.stringify(ips_both),
      out_dir + '/' + name_a + '+' + name_b + '/' + asn + '.json');
  fs.writeFileSync(JSON.stringify(ips_aonly),
      out_dir + '/' + name_a + '-' + name_b + '/' + asn + '.json');
  fs.writeFileSync(JSON.stringify(ips_bonly),
      out_dir + '/' + name_b + '-' + name_a + '/' + asn + '.json');
};
