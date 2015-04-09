var color = color = d3.scale.ordinal().range(['#777', '#797979', '#888', '#898989', '#999', '#9a9a9a', '#aaaaaa', 'bababa']),
  container = $('#map'),
  width = container.width(),
  height = width * 0.65,
  bounds, projection, path, svg, vis, tooltip,
  svgOffset = container.offset();

projection = d3.geo.mercator();

path = d3.geo.path()
  .projection(projection);

svg = d3.select('#map').append('svg')
  .style('width', width + 'px')
  .style('height', height + 'px');

vis = svg.append('g');

svg.call(d3.behavior.zoom()
  .scaleExtent([1, 10])
  .on('zoom', function () {
    vis.attr('transform', 'translate(' + d3.event.translate.join(',') + ')scale(' + d3.event.scale + ')');
  }));

tooltip = d3.select('#map').append('div').attr('class', 'map-tooltip hidden');

function drawMap(error, data) {
  var countries = topojson.feature(data, data.objects.countries),
    neighbors = topojson.neighbors(data.objects.countries.geometries),
    s, t;

  projection.scale(1)
    .translate([0, 0]);

  bounds = path.bounds(countries);
  s = 1.0 / Math.max((bounds[1][0] - bounds[0][0]) / width, (bounds[1][1] - bounds[0][1]) / height);
  t = [(width - s * (bounds[1][0] + bounds[0][0])) / 2, (height - s * (bounds[1][1] + bounds[0][1])) / 2];

  projection
    .scale(s)
    .translate(t);

  vis.selectAll('.country').data(countries.features)
    .enter()
    .insert('path')
    .attr('class', 'country')
    .attr('title', function (d, i) {
      return d.name;
    })
    .attr('d', path)
    .style('fill', function (d, i) {
      return color(d.color = d3.max(neighbors[i], function (n) {
        return countries.features[n].color;
      }) + 1 | 0);
    })
    .on('mousemove', function (d, i) {
      d3.select(this.parentNode.appendChild(this))
        .style({'stroke-opacity': 1});
      var mouse = d3.mouse(svg.node()).map(function (d) {
        return parseInt(d);
      });
      tooltip.classed('hidden', false)
        .attr('style', 'left:' + (mouse[0] + svgOffset.left + 10) + 'px;top:' + (mouse[1] + svgOffset.top - 10) + 'px')
        .html(d.properties.name);
    })
    .on('mouseout', function (d, i) {
      d3.select(this)
        .style({'stroke-opacity': 0});
      tooltip.classed('hidden', true);
    })
    .on('click', function (d, i) {
      showTable(d.properties.name, d.id);
    });
}

function resize() {
  var newWidth = container.width();

  if (newWidth != width) {
    width = newWidth;
    height = 0.65 * width;
    svgOffset = container.offset();

    s = 1.0 / Math.max((bounds[1][0] - bounds[0][0]) / width, (bounds[1][1] - bounds[0][1]) / height);
    t = [(width - s * (bounds[1][0] + bounds[0][0])) / 2, (height - s * (bounds[1][1] + bounds[0][1])) / 2];

    projection
      .scale(s)
      .translate(t);

    svg.style('width', width + 'px')
      .style('height', height + 'px');

    svg.selectAll('.country').attr('d', path);
  }
}

d3.json('/json/world.json', drawMap);
d3.select(window).on('resize', resize);

function showTable(country, code) {
  $.ajax({
    url: '/country',
    data: {country: code},
    context: document.body
  }).done(function(data) {
    $('.modal .title').html(country);
    console.log(data);
    $('.modal-body').html(data);
    $('.modal').modal('show');
  });
}