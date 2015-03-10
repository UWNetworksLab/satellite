require('Highcharts');
var $ = require('jquery');
var asn_name = require('./asn_name.json');
var asn_country = require('./asn_country.json');
var Q = require('q');

var options = {
  chart: {
    renderTo: 'container',
    type: 'column',
    height: 600
  },
  title: {
    text: 'Stacked column chart'
  },
  yAxis: {
    allowDecimals: false,
    stackLabels: {
      enabled: true,
      style: {
        fontWeight: 'bold',
        color: (Highcharts.theme && Highcharts.theme.textColor) || 'gray'
      }
    }
  },
  legend: {
    enabled: false
  },
  tooltip: {
    formatter: function () {
      return this.series.name + '  ' + asn_name[this.series.name] + ': ' + this.y + '<br/>';
    }
  },
  plotOptions: {
    column: {
      stacking: 'normal'
    }
  }
};

function makeChart(domains, countries) {
  Q.all(domains.map(function (domainName) {
    return Q(jQuery.ajax({
      url: 'runs/02-16-2015/' + domainName + '.csv.asn.json',
      type: 'GET'
    })).then(function (domainData) {
      return Q.promise(function (resolve, reject) {
        resolve({name: domainName, data: domainData});
      })
    });
  })).then(function (data) {
    var answerASNs = {},
      domain_country_answerASN = {};

    data.forEach(function (domainData) {
      var domainName = domainData.name;
      domainData = domainData.data;

      domain_country_answerASN[domainName] = {};

      Object.keys(domainData).forEach(function (resolverASN) {
        var resolverCountry = asn_country[resolverASN];

        if (countries[resolverCountry]) {
          domain_country_answerASN[domainName][resolverCountry] = domain_country_answerASN[domainName][resolverCountry] || {};

          Object.keys(domainData[resolverASN]).filter(function (answerASN) {
            return answerASN !== 'empty';
          }).forEach(function (answerASN) {
              answerASNs[answerASN] = true;
              domain_country_answerASN[domainName][resolverCountry][answerASN] = domain_country_answerASN[domainName][resolverCountry][answerASN] || 0;
              domain_country_answerASN[domainName][resolverCountry][answerASN] += domainData[resolverASN][answerASN];
          });
        }
      })
    });

    var result = [];
    data.forEach(function (domainData) {
      var domainName = domainData.name;

      Object.keys(answerASNs).forEach(function (answerASN) {
        var series = Object.keys(countries).map(function (country) {
          return domain_country_answerASN[domainName][country] &&  domain_country_answerASN[domainName][country][answerASN] ? domain_country_answerASN[domainName][country][answerASN] : 0;
        });

        if (Math.max.apply(Math, series) > 10) {
          result.push({
            name: answerASN,
            data: series,
            stack: domainName
          });
        }
      });
    });

    return new Highcharts.Chart($.extend({
      series: result,
      xAxis: {
        categories: Object.keys(countries)
      }
    }, options))
  });
}

exports.makeChart = makeChart;
