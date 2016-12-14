/**
 * Loads a file encoded in new-line delimited json of arrays into a single
 * dictionary where the first element of each array is a key, and the entry is the value.
 */

var fs = require('fs');

exports.load = function(file) {
  var data = fs.readFileSync(file).toString();
  var outarr = {};
  data.split('\n').forEach(function(line) {
    try {
      var entry = JSON.parse(line.trim());
      outarr[entry[0]] = entry;
    } catch(e) {
      return;
    }
  });
  return outarr;
};
