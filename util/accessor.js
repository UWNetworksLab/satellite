/* jslint node:true */
'use strict';

/**
 * given run info, which looks like:
 * {
 * [name: 'run/80-syn.csv', port: 80, mode: 'syn'],
 * [name: 'run/80-ack.csv', port: 80, mode: 'ack'],
 * ...
 * }
 * This module creates the methods you want, namely:
 * new accessor(file).ports() -> [80]
 *                   .modes() -> ['syn', 'ack']
 */

function mapper (key) {
  var out = {};
  return this.data.map(function (item) {
    out[item[key]] = true;
  });
  return Object.keys(out);
}

function filterer (key, val) {
  return this.data.filter(function (item) {
    return item[key] === val;
  });
}

module.exports = function (file) {
  var keys;

  this.data = JSON.parse(fs.readFileSync(file));
  keys = Object.keys(this.data[0]);

  keys.forEach(function (key) {
    this[key + 's'] = mapper.bind(this, key);
    this['with' + key] = filterer.bind(this, key);
  });
};
