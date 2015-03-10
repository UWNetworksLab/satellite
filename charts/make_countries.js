var a2c = require('../asn_aggregation/asn_country.js');
var fs = require('fs');
var chalk = require('chalk');

console.log(chalk.blue('Refreshing ASN -> Country map.'));
a2c.onReady.then(function () {
	fs.writeFileSync('asn_country.json', JSON.stringify(a2c.db));
	console.log(chalk.green('Done'));
});
