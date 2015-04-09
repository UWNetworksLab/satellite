var express = require('express');
var router = express.Router();

router.get('/', function (req, res, next) {
	var country = req.query.country;
	res.render('country', {country: country});
});

module.exports = router;
