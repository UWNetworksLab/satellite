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
    type: 'logarithmic',
    allowDecimals: false,
    min: 1,
    stackLabels: {
      enabled: true,
      style: {
        fontWeight: 'bold',
        color: (Highcharts.theme && Highcharts.theme.textColor) || 'gray'
      }
    }
  },
  legend: {
    align: 'right',
    x: -30,
    verticalAlign: 'top',
    y: 25,
    floating: true,
    backgroundColor: (Highcharts.theme && Highcharts.theme.background2) || 'white',
    borderColor: '#CCC',
    borderWidth: 1,
    shadow: false
  },
  tooltip: {
    formatter: function () {
      return '<b>' + this.x + '</b><br/>' +
        this.series.name + ': ' + this.y + '<br/>' +
        'Total: ' + this.point.stackTotal;
    }
  },
  plotOptions: {
    column: {
      stacking: 'normal'
    }
  }
};

function makeChart(domains, country) {
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
    var resolverASNs = {},
      answerASNs = {},
      result = [],
      resolverList;

    data.forEach(function (domainData) {
      var domainName = domainData.name;
      domainData = domainData.data;

      Object.keys(domainData).filter(function (resolverKey) {
        return country !== 'Global' ? asn_country[resolverKey] === country : true
      }).forEach(function (resolverKey) {
        resolverASNs[resolverKey] = true;

        Object.keys(domainData[resolverKey]).filter(function (el) {
          return el !== 'empty';
        }).forEach(function (answerKey) {
          answerASNs[answerKey] = true;
        });
      });
    });

    resolverList = Object.keys(resolverASNs).sort();

    data.forEach(function (domainData) {
      var domainName = domainData.name;

      domainData = domainData.data;

      Object.keys(answerASNs).forEach(function (answerASN) {
        var series = resolverList.map(function (resolverASN) {
          return (domainData[resolverASN] && domainData[resolverASN][answerASN]) ? domainData[resolverASN][answerASN] : 0;
        });

        result.push({
          name: answerASN,
          data: series,
          stack: domainName
        });
      });
    });

    return new Highcharts.Chart($.extend({
      series: result,
      xAxis: {
        categories: resolverList
      }
    }, options))
  });
}

exports.makeChart = makeChart;
