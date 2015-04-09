var express = require('express');
var path = require('path');
var auth = require('http-auth');

var country = require('./routes/country');

var app = express();

/*var basic = auth.basic({
  realm: "Private area",
  file: __dirname + "/htpasswd"
});

app.use(auth.connect(basic));*/

//app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', function (req, res, next) {
	res.render('index');
});

app.use('/country', country);


app.use(function(req, res, next) {
	var err = new Error('Not Found');
	err.status = 404;
	next(err);
});

if (app.get('env') === 'development') {
	app.use(function(err, req, res, next) {
		res.status(err.status || 500);
		res.render('error', {
			message: err.message,
			error: err
		});
	});
}

app.use(function(err, req, res, next) {
	res.status(err.status || 500);
	res.render('error', {
		message: err.message,
		error: {}
	});
});

var port = process.env.PORT || 8888;
app.listen(port, function() {
  console.log("Listening on " + port);
});
