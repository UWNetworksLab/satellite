require('Highcharts');
var $ = require('jquery');
var asn_asn = require('./asn_asn.json');
var asn_country = require('./asn_country.json');

var chart,
  options = {
    chart: {
      renderTo: 'container',
      type: "spline",
      height: 800,
      zoomType: 'x'
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
      spline: {
        turboThreshold: 10000,
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
      headerFormat: '<span style="font-size: 10px">{point.y} resolutions to ASN: {point.key}</span><br/>',
      pointFormat: ''
    }
  };

function makeSeries() {
  var domain = $('#domain').find(':selected').val(),
    country = $('#country').find(':selected').val(),
    asns = Object.keys(asn_asn[domain]).filter(function (key) {
      return key !== 'length';
    }),
    totals = {},
    data;

  if (country !== 'Global') {
    asns = asns.filter(function (key) {
      return asn_country[key] === country;
    });
  }

  for (var i = 0; i < asns.length; i++) {
    var resolverASN = asns[i],
      answerASNs = Object.keys(asn_asn[domain][resolverASN]).filter(function (el) {
        return el !== 'empty' && el !== 'unknown';
      });

    for (var j = 0; j < answerASNs.length; j++) {
      totals[answerASNs[j]] = totals[answerASNs[j]] || 0;
      totals[answerASNs[j]] += asn_asn[domain][resolverASN][answerASNs[j]];
    }
  }

  data = Object.keys(totals).map(function (key) {
    return {
      name: key,
      y: totals[key]
    }
  });

  data.sort(function (a, b) {
    return a.y - b.y;
  });

  return [{
    name: domain,
    data: data
  }];
}

function updateChart() {
  chart = new Highcharts.Chart($.extend({
    series: makeSeries()
  }, options));
}

// domain dropdown
$('#domain').change(updateChart);

Object.keys(asn_asn).filter(function (el) {
  return el !== 'length';
}).map(function (el) {
  $('#domain').append("<option>" + el + "</domain>");
});

// country dropdown
$('#country').change(updateChart);

updateChart();