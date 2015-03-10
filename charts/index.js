var $ = require('jquery');
var chart1 = require('./chart1.js');
var chart2 = require('./chart2.js');
var chart3 = require('./chart3.js');

function updateChart() {
  var type = $('#chart-type').val(),
    country = $('#country').find(':selected').val(),
    domains = $('#domains').val();

  if (type === 'Chart #1') {
    chart1.makeChart(domains, country);
  } else if (type === 'Chart #2') {
    chart2.makeChart(domains, country);
  } else if (type === 'Chart #3') {
    chart3.makeChart(domains, country);
  }
}

// domain dropdown
$('#domains').change(updateChart);

$.get("runs/02-16-2015.txt", function (data) {
  data.split('\n').forEach(function (el) {
    $('#domains').append("<option>" + el + "</domain>");
  });
});

// country dropdown
$('#country').change(updateChart);

// country dropdown
$('#chart-type').change(updateChart);