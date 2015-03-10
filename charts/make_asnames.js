var a2c = require('../asn_aggregation/asn_name.js');
var fs = require('fs');
var chalk = require('chalk');

console.log(chalk.blue('Refreshing ASN -> AS name map.'));
a2c.onReady.then(function () {
	fs.writeFileSync('asn_name.json', JSON.stringify(a2c.db));
	console.log(chalk.green('Done'));
});
