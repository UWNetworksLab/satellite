var fs = require('fs');

var when = argv[2];
require('ip2country/src/build').getGenericMap(false, false, when).then(function (map) {
  fs.writeFileSync(when + '.lookup.json', JSON.stringify(map));
  console.log('done')
});

