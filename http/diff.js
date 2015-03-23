/*jslint node:true*/
'use strict';

var fs = require('fs');

var splitter = require('./split');

// From a pair of scans, calculate intersection & partials.
exports.diff = function (asnInfo, file_a, name_a, file_b, name_b, out_dir) {
  // Strategy:
  // Split each file if not already, then run alg for each ASN.
  var dir_a = out_dir + '/' + name_a + '.components',
    dir_b = out_dir + '/' + name_b + '.components';
  fs.makeDirSync(out_dir + '/' + name_a + '+' + name_b);
  fs.makeDirSync(out_dir + '/' + name_a + '-' + name_b);
  fs.makeDirSync(out_dir + '/' + name_b + '-' + name_a);

  var ret = Q(0);

  if (!fs.existsSync(dir_a)) {
    fs.makeDirSync(dir_a);
    ret.then(function () {
      return splitter.split(asnInfo, file_a, dir_a);
    });
  }
  if (!fs.existsSync(dir_b)) {
    fs.makeDirSync(dir_b);
    ret.then(function () {
      return splitter.split(asnInfo, file_b, dir_b);
    });
  }
  ret.then(function () {
    // Get asns & run sorted walk.
    var asns_a = fs.readdirSync(dir_a),
      asns_b = fs.readdirSync(dir_b),
      i = 0, asni,
      j = 0, asnj;
    while (i < asns_a.length && j < asns_b.length) {
      asn_i = asns_a[i], asn_j = asns_b[j];
      if ((asn_i < asn_j && i < asns_a.length) || j === asns_b.length) {
        exports.diffASN(dir_a + '/' + asn_i, name_a, undefined , name_b, asn_i, out_dir);
        i += 1;
      } else if (asn_i == asn_j) {
        exports.diffASN(dir_a + '/' + asn_i, name_a, dir_b + '/' + asn_j , name_b, asn_i, out_dir);
        i += 1;
        j += 1;
      } else { // asn_i > asn_j
        exports.diffASN(undefined, name_a, dir_b + '/' + asn_j , name_b, asn_j, out_dir);
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
