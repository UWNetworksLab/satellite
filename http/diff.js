/*jslint node:true*/
'use strict';

var chalk = require('chalk');
var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var Q = require('q');
var liner = require('../util/liner').liner;
var diffStream = require('sorted-diff-stream');

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
  mkdirp.sync(out_dir + '/' + name_a + '+' + name_b);
  mkdirp.sync(out_dir + '/' + name_a + '-' + name_b);
  mkdirp.sync(out_dir + '/' + name_b + '-' + name_a);

  var ret = Q(0);

  if (!fs.existsSync(dir_a)) {
    mkdirp.sync(dir_a);
    ret = ret.then(function () {
      return splitter.split(asnInfo, file_a, dir_a);
    });
  }
  if (!fs.existsSync(dir_b)) {
    mkdirp.sync(dir_b);
    ret = ret.then(function () {
      return splitter.split(asnInfo, file_b, dir_b);
    });
  }
  return ret.then(function () {
    // Get asns & run sorted walk.
    var asns_a = fs.readdirSync(dir_a),
      asns_b = fs.readdirSync(dir_b),
      i = 0, asn_i,
      j = 0, asn_j;

    var chain = Q(0);
    while (i < asns_a.length && j < asns_b.length) {
      asn_i = asns_a[i], asn_j = asns_b[j];
      if ((asn_i < asn_j && i < asns_a.length) || j === asns_b.length) {
        chain = chain.then(exports.diffASN(
          dir_a + '/' + asn_i,
          name_a,
          undefined,
          name_b,
          asn_i,
          out_dir
        ));
        i += 1;
      } else if (asn_i == asn_j) {
        chain = chain.then(exports.diffASN(
          dir_a + '/' + asn_i,
          name_a,
          dir_b + '/' + asn_j,
          name_b,
          asn_i,
          out_dir
        ));
        i += 1;
        j += 1;
      } else { // asn_i > asn_j
        chain = chain.then(exports.diffASN(
          undefined,
          name_a,
          dir_b + '/' + asn_j,
          name_b,
          asn_j,
          out_dir
        ));
        j += 1;
      }
    }
    return chain;
  });
};

/// For pair of ips in an ASN, calculate intersection & partials
exports.diffASN = function (file_a, name_a, file_b, name_b, asn, out_dir) {
  if (!fs.existsSync(file_a)) {
    fs.copyFileSync(file_b, out_dir + '/' + name_b + '-' + name_a + '/' + asn + '.json')
    return Q(0);
  }
  if (!fs.existsSync(file_b)) {
    fs.copyFileSync(file_a, out_dir + '/' + name_a + '-' + name_b + '/' + asn + '.json')
    return Q(0);
  }

  return Q.Promise(function (fa, na, fb, nb, as, ot, resolve) {
    var stream_a = fs.createReadStream(fa),
      stream_b = fs.createReadStream(fb);

      var both = fs.createWriteStream(
            ot + '/' + na + '+' + nb + '/' + as + '.json'),
          aonly = fs.writeFileSync(
            ot + '/' + na + '-' + nb + '/' + as + '.json'),
          bonly = fs.writeFileSync(
            ot + '/' + nb + '-' + na + '/' + as + '.json');

      var iseq = function (a, b) {
        if (a === b) {
          both.write(a);
          both.write('\n');
          return true;
        }
        return false;
      };

      var diffs = diffStream(stream_a.pipe(liner), stream_b.pipe(liner), iseq);
      diffs.on('data', function(diff) {
        if (diff[0]) {
          aonly.write(diff[0]);
          aonly.write('\n');
        } else {
          bonly.write(diff[1]);
          bonly.write('\n');
        }
      });
      diffs.on('end', function () {
        both.end();
        resolve();
      });
    }.bind({},file_a, name_a, file_b, name_b, asn, out_dir));
};
