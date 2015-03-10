var express = require("express");
var auth = require("http-auth");
var app = express();

var basic = auth.basic({
  realm: "Private area",
  file: __dirname + "/htpasswd"
});

app.use(auth.connect(basic));

/* serves main page */
app.get("/", function(req, res) {
  try {
    res.sendfile(__dirname + '/index.html');
  } catch(e){}
});

/* serves all the static files */
app.get(/^(.+)$/, function(req, res){ 
  try{
    console.log('static file request : ' + req.params);
    res.sendfile( __dirname + req.params[0]);
  }catch(e){}
});

var port = process.env.PORT || 8888;
app.listen(port, function() {
  console.log("Listening on " + port);
});
