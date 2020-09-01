const STORE = {
  json: null,
  originalJSON: null,
  url: null
}

document.addEventListener("DOMContentLoaded", function () {
  document.getElementById("filter").addEventListener("submit", submitEvent);
  document.getElementById("dowload").addEventListener("click", downloadEvent);
});
function downloadEvent(e) {
  downloadObjectAsJson(STORE.json, 'custom-geojson.json')
}
function submitEvent(e) {
  e.preventDefault();
  const url = e.target.url.value;
  const points = e.target.points.value;
  const precision = e.target.precision.value;
  const strategy = e.target.strategy.value;


  main(url, points, precision, strategy)
}

function main(url, points, precision, strategy) {

  const div = '#container';

  d3.select(div).html('Loading resources...')

  if (STORE.url === url) {
    const json = JSON.parse(STORE.originalJSON);
    execute(div, json, precision, points, strategy)
    return
  }

  d3.json(url, function (error, json) {
    console.log(url)
    if (error) throw error;
    STORE.url = url;
    STORE.originalJSON = JSON.stringify(json);
    execute(div, json, precision, points, strategy)
  })
}

function execute(div, json, precision, points, strategy) {
  json.features = makeReduction(json.features, precision, points, strategy)
  console.log(json.features[0].geometry.coordinates);
  STORE.json = json;
  makeChart(div, STORE.json);
}


function example() {
  const url3 = `https://raw.githubusercontent.com/Irio/br-atlas/master/geo/ac-municipalities.json`;
  main(url)
}

function downloadObjectAsJson(exportObj, exportName) {
  var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObj));
  var downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute("download", exportName + ".json");
  document.body.appendChild(downloadAnchorNode); // required for firefox
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
}



function makeReduction(features, precision = 5, reduce = 10, strategy = 'mean') {
  return features.map(f => {
    let coordinatesNew = coordinates = f.geometry.coordinates[0];

    if (strategy == 'distance') {
      coordinatesNew = distanceStrategy(coordinates, reduce)
    } else if (reduce > 1 && coordinates.length > reduce * 10) {
      if (strategy == 'avg') {
        coordinatesNew = avgStrategy(coordinatesNew, reduce);
      } else if (strategy == 'mean') {
        coordinatesNew = meanStrategy(coordinatesNew, reduce);
      } else if (strategy == 'skip') {
        coordinatesNew = skipStrategy(coordinates, reduce)
      }
      else {
        coordinatesNew = modeStrategy(coordinatesNew, reduce);
      }
    }

    if (precision > 1) {
      coordinatesNew = coordinatesNew.map(c => {
        if (!c[0] || !c[1] || !c[0].toPrecision || !c[1].toPrecision) {
          return c;
        }
        return [
          parseFloat(c[0].toPrecision(precision)),

          parseFloat(c[1].toPrecision(precision))
        ];
      })
    }
    f.geometry.coordinates[0] = coordinatesNew;
    return f;
  });
}


function skipStrategy(coordinates, reduce) {
  let skip = 1;
  coordinatesNew = []
  coordinates.forEach(c => {
    if (skip == reduce) {
      skip = 0;
      coordinatesNew.push([
        c[0],
        c[1]
      ]);
    }
    skip++;
  })
  return coordinatesNew;
}


function distanceStrategy(coordinates, reduce) {
  let skip = 1;
  let previous;
  coordinatesNew = []
  coordinates.forEach(c => {
    if (!previous) {
      previous = c;
      coordinatesNew.push(c);
      return
    }
    const latDiff = Math.abs(c[0] - previous[0]);
    const lonDiff = Math.abs(c[1] - previous[1]);

    if (latDiff > reduce || lonDiff > reduce) {
      coordinatesNew.push(c);
    } else {
      skip++;
    }

  })
  return coordinatesNew;
}




function modeStrategy(coordinates, reduce) {
  let skip = 1;
  let lat = [];
  let lng = [];
  coordinatesNew = []

  coordinates.forEach(c => {

    lat.push(c[0])
    lng.push(c[1])
    const middle = reduce / 2;
    if (skip == reduce) {
      skip = 0;
      coordinatesNew.push([
        lat[middle],
        lng[middle]
      ]);
      lat = [];
      lng = [];

    }
    skip++;
  })
  return coordinatesNew;
}



function avgStrategy(coordinates, reduce) {
  let skip = 1;
  let lat = [];
  let lng = [];
  coordinatesNew = []
  coordinates.forEach(c => {
    lat += c[0];
    lng += c[1];
    if (skip == reduce) {
      skip = 0;
      coordinatesNew.push([
        lat / reduce,
        lng / reduce
      ])
    }
    skip++;
  })
  return coordinatesNew
}

function meanStrategy(coordinates, reduce) {
  let skip = 1;
  let lat = [];
  let lng = [];
  coordinatesNew = []
  coordinates.forEach(c => {

    lat.push(c[0])
    lng.push(c[1])
    const middle = reduce / 2;
    if (skip == reduce) {
      skip = 0;
      lat = lat.sort((a, b) => a > b ? 1 : -1)
      lng = lng.sort((a, b) => a > b ? 1 : -1)
      coordinatesNew.push([
        lat[middle],
        lng[middle]
      ]);
      lat = [];
      lng = [];

    }
    skip++;
  })
  return coordinatesNew;
}

function makeChart(div, json) {
  var width = 960,
    height = 500;


  var vis = d3.select(div).html('').append("svg")
    .attr("width", width).attr("height", height)
  // create a first guess for the projection
  var center = d3.geo.centroid(json)
  var scale = 1500;
  var offset = [width / 2, height / 2];
  var projection = d3.geo.mercator()
    .scale(scale).center(center)
    .translate(offset);

  // create the path
  var path = d3.geo.path().projection(projection);

  // using the path determine the bounds of the current map and use 
  // these to determine better values for the scale and translation
  var bounds = path.bounds(json);
  var hscale = scale * width / (bounds[1][0] - bounds[0][0]);
  var vscale = scale * height / (bounds[1][1] - bounds[0][1]);
  var scale = (hscale < vscale) ? hscale : vscale;
  var offset = [width - (bounds[0][0] + bounds[1][0]) / 2,
  height - (bounds[0][1] + bounds[1][1]) / 2];

  // new projection
  projection = d3.geo.mercator().center(center)
    .scale(scale).translate(offset);
  path = path.projection(projection);

  // add a rectangle to see the bound of the svg
  vis.append("rect").attr('width', width).attr('height', height)
    .style('stroke', 'black').style('fill', 'none');

  vis.selectAll("path").data(json.features).enter().append("path")
    .attr("d", path)
    .style("fill", "red")
    .style("stroke-width", "1")
    .style("stroke", "black")
}

