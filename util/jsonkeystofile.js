/**
 * Usage: jsonkeystofile.js <in.json> <out.txt>
 * Takes each key in the json object, and puts it on a new line in out.txt
 */

var fs = require('fs');

var data = JSON.parse(fs.readFileSync(process.argv[2]));
var keys = Object.keys(data);
fs.writeFileSync(process.argv[3], keys.join('\n'));
