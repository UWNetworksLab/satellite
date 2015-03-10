var Q = require('q');

var regex = /\d+.*AS(\d+).*\/\d*\.\d*.*\/\d*\.\d*\ *(.*)/;
var makeDB = function(page) {
	var lines = page.split('\n');
	var db = {};
	for (var i = 0; i < lines.length; i+=1) {
		var out = regex.exec(lines[i]);
		if (out) {
			db[out[1]] = out[2];
		}
	}
	return db;
};

var http = require('http');
var load = function(cb) {
	var url = "http://www.cidr-report.org/as2.0/bgp-originas.html";
	http.get(url, function(res) {
		var data = '';
		res.on('data', function (chunk) {
			data += chunk.toString();
		});
		res.on('end', function () {
			exports.db = makeDB(data);
			console.log('db done');
			cb();
		});
	});
};

exports.onReady = new Q.Promise(function (resolve,reject) {
	load(resolve);
});
