
var csv = require('csv');
var asnumdata = null;
csv().from.path('./geodata/geoip-asnum.csv').to.array( function(data){
  asnumdata=data
});

// ASYNC

var aton  = function(a) {
  a = a.split(/\./);
  return ((parseInt(a[0], 10)<<24)>>>0) + ((parseInt(a[1], 10)<<16)>>>0) +
        ((parseInt(a[2], 10)<<8)>>>0) + (parseInt(a[3], 10)>>>0);
};
var get_helper = function(ip)
{
    if(typeof ip != 'number')
    {
        ip = aton(ip)
    }
    for (i in asnumdata)
    {
        row=asnumdata[i]
        if(ip>=row[0] && ip<=row[1])
        {
            return row[2]
        }
    }
    return null
}

// ASYNC

var asns = ips.map(function(ip) {return get_helper(ip.split(':')[0])});
//clean up.
asns = asns.map(function(str) {return str ? parseInt(str.split(' ')[0].substr(2)) : -1});

// ASYNC
// Map a buffer of domains into counts of good, bad per asn.
var pool = {};
asns.forEach(function(n) {if(!pool[n]) pool[n] = [0,0]});
for (var i = 0; i < b.length; i++) {
  var asn = asns[i % asns.length];
  if (b[i]) {
    pool[asn][0] += 1;
  } else {
    pool[asn][1] += 1;
  }
}

fs.writeFileSync('out', JSON.stringify(pool));