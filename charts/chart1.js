require('Highcharts');
var $ = require('jquery');
var asn_name = require('./asn_name.json');
var asn_country = require('./asn_country.json');
var Q = require('q');

var options = {
  chart: {
    renderTo: 'container',
    type: "line",
    height: 600
  },
  credits: {
    enabled: false
  },
  xAxis: {
    labels: {
      enabled: false
    }
  },
  yAxis: {
    type: 'logarithmic',
    title: {
      text: '# of resolutions'
    }
  },
  plotOptions: {
    series: {
      cursor: 'pointer',
      point: {
        events: {
          click: function () {
            window.open('http://bgp.he.net/AS' + this.name, '_blank');
          }
        }
      },
      turboThreshold: 5000
    },
    spline: {
      lineWidth: 2,
      states: {
        hover: {
          enabled: true,
          lineWidth: 3
        }
      },
      marker: {
        enabled: false,
        states: {
          hover: {
            enabled: true,
            radius: 5,
            lineWidth: 1
          }
        }
      }
    }
  },
  title: {
    text: ''
  },
  tooltip: {
    formatter: function () {
      return '<span style="font-size: 10px">' +
        this.y +
        ' resolutions to ASN: ' + this.key + '</span><br/>' +
        '<span>' + asn_name[this.key] + '</span>'
    },
    pointFormat: ''
  }
};

function makeChart(domains, country) {
  return Q.all(domains.map(function (domainName) {
    return Q(jQuery.ajax({
      url: 'runs/02-16-2015/' + domainName + '.csv.asn.json',
      type: 'GET'
    })).then(function (domainData) {
      var totals = {},
        resolverASNs;

      if (country !== 'Global') {
        resolverASNs = Object.keys(domainData).filter(function (key) {
          return key !== 'length' && asn_country[key] === country;
        });
      } else {
        resolverASNs = Object.keys(domainData).filter(function (key) {
          return key !== 'length';
        });
      }

      resolverASNs.forEach(function (resolverASN) {
        var resolverData = domainData[resolverASN],
          answerASNs = Object.keys(resolverData).filter(function (el) {
            return el !== 'empty' && el !== 'unknown';
          });

        answerASNs.forEach(function (answerASN) {
          totals[answerASN] = totals[answerASN] || 0;
          totals[answerASN] += resolverData[answerASN];
        });
      });

      var data = Object.keys(totals).map(function (key) {
        return {
          name: key,
          y: totals[key]
        }
      });

      data.sort(function (a, b) {
        return a.y - b.y;
      });

      data.map(function (val, idx, arr) {
        val.x = (idx * 10000) / arr.length;
      });

      return {
        name: domainName,
        data: data
      };
    }, function (xhr) {
      // on failure
    });
  })).then(function (series) {
      return new Highcharts.Chart($.extend({series: series}, options))
    }
  );
}

exports.makeChart = makeChart;
