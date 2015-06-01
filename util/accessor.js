/*jslint node:true */
'use strict';

var fs = require('fs');

/**
 * given run info, which looks like:
 * {
 * [name: 'run/80-syn.csv', port: 80, mode: 'syn'],
 * [name: 'run/80-ack.csv', port: 80, mode: 'ack'],
 * ...
 * }
 * This module creates the methods you want, namely:
 *
 * new Accessor(file).ports() -> [80]
 *                   .modes() -> ['syn', 'ack']
 */

function mapper(data, key) {
  var out = {};
  data.map(function (item) {
    out[item[key]] = true;
  });
  return Object.keys(out);
}

function filterer(data, key, val) {
  return data.filter(function (item) {
    return item[key] === val;
  });
}

var Accessor = function (file) {
  var keys, data;

  data = JSON.parse(fs.readFileSync(file));
  keys = Object.keys(data[0]);

  keys.forEach(function (key) {
    this[key + 's'] = mapper.bind(this, data, key);
    this['with' + key] = filterer.bind(this, data, key);
  }.bind(this));
};

module.exports = Accessor;
