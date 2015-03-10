require('Highcharts');
var $ = require('jquery');
var asn_name = require('./asn_name.json');
var asn_country = require('./asn_country.json');
var Q = require('q');

var countries = {
  //AD: true,
  //AE: true,
  //AF: true,
  //AG: true,
  //AI: true,
  //AL: true,
  //AM: true,
  //AO: true,
  //AR: true,
  //AS: true,
  //AT: true,
  //AU: true,
  //AW: true,
  //AX: true,
  //AZ: true,
  //BA: true,
  //BB: true,
  //BD: true,
  //BE: true,
  //BF: true,
  //BG: true,
  //BH: true,
  //BI: true,
  //BJ: true,
  //BL: true,
  //BM: true,
  //BN: true,
  //BO: true,
  //BQ: true,
  //BR: true,
  //BS: true,
  //BT: true,
  //BW: true,
  //BY: true,
  //BZ: true,
  CA: true,
  //CD: true,
  //CF: true,
  //CG: true,
  //CH: true,
  //CI: true,
  //CK: true,
  //CL: true,
  //CM: true,
  CN: true,
  //CO: true,
  //CR: true,
  //CU: true,
  //CV: true,
  //CW: true,
  //CY: true,
  //CZ: true,
  //DE: true,
  //DJ: true,
  //DK: true,
  //DM: true,
  //DO: true,
  //DZ: true,
  //EC: true,
  //EE: true,
  //EG: true,
  //ER: true,
  ES: true,
  //ET: true,
  //EU: true,
  //FI: true,
  //FJ: true,
  //FM: true,
  //FO: true,
  FR: true,
  //GA: true,
  GB: true,
  //GD: true,
  //GE: true,
  //GF: true,
  //GG: true,
  //GH: true,
  //GI: true,
  //GL: true,
  //GM: true,
  //GN: true,
  //GP: true,
  //GQ: true,
  //GR: true,
  //GT: true,
  //GU: true,
  //GW: true,
  //GY: true,
  //HK: true,
  //HN: true,
  //HR: true,
  //HT: true,
  //HU: true,
  //ID: true,
  //IE: true,
  //IL: true,
  //IM: true,
  IN: true,
  //IO: true,
  //IQ: true,
  //IR: true,
  //IS: true,
  //IT: true,
  //JE: true,
  //JM: true,
  //JO: true,
  //JP: true,
  //KE: true,
  //KG: true,
  //KH: true,
  //KM: true,
  //KN: true,
  //KP: true,
  //KR: true,
  //KW: true,
  //KY: true,
  //KZ: true,
  //LA: true,
  //LB: true,
  //LI: true,
  //LK: true,
  //LR: true,
  //LS: true,
  //LT: true,
  //LU: true,
  //LV: true,
  //LY: true,
  //MA: true,
  //MC: true,
  //MD: true,
  //ME: true,
  //MF: true,
  //MG: true,
  //MH: true,
  //MK: true,
  //ML: true,
  //MM: true,
  //MN: true,
  //MO: true,
  //MP: true,
  //MR: true,
  //MT: true,
  //MU: true,
  //MV: true,
  //MW: true,
  //MX: true,
  //MY: true,
  //MZ: true,
  //NA: true,
  //NC: true,
  //NE: true,
  //NF: true,
  //NG: true,
  //NI: true,
  //NL: true,
  //NO: true,
  //NP: true,
  //NR: true,
  //NU: true,
  //NZ: true,
  //OM: true,
  //PA: true,
  //PE: true,
  //PF: true,
  //PG: true,
  //PH: true,
  PK: true,
  //PL: true,
  //PM: true,
  //PR: true,
  //PS: true,
  //PT: true,
  //PW: true,
  //PY: true,
  //QA: true,
  //RE: true,
  //RO: true,
  //RS: true,
  //RU: true,
  //RW: true,
  //SA: true,
  //SB: true,
  //SC: true,
  //SD: true,
  //SE: true,
  //SG: true,
  //SI: true,
  //SK: true,
  //SL: true,
  //SM: true,
  //SN: true,
  //SO: true,
  //SR: true,
  //SS: true,
  //ST: true,
  //SV: true,
  //SX: true,
  //SY: true,
  //SZ: true,
  //TC: true,
  //TD: true,
  //TG: true,
  //TH: true,
  //TJ: true,
  //TK: true,
  //TL: true,
  //TM: true,
  //TN: true,
  //TO: true,
  TR: true,
  //TT: true,
  //TW: true,
  //TZ: true,
  //UA: true,
  //UG: true,
  US: true
  //UY: true,
  //UZ: true,
  //VA: true,
  //VC: true,
  //VE: true,
  //VG: true,
  //VI: true,
  //VN: true,
  //VU: true,
  //WF: true,
  //WS: true,
  //YE: true,
  //YT: true,
  //ZA: true,
  //ZM: true,
  //ZW: true
};

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
            if (domainData[resolverASN][answerASN] > 5) {
              answerASNs[answerASN] = true;
              domain_country_answerASN[domainName][resolverCountry][answerASN] = domain_country_answerASN[domainName][resolverCountry][answerASN] || 0;
              domain_country_answerASN[domainName][resolverCountry][answerASN] += domainData[resolverASN][answerASN];
            }
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
        categories: Object.keys(countries)
      }
    }, options))
  });
}

exports.makeChart = makeChart;
