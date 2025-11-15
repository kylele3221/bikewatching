import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

mapboxgl.accessToken = 'pk.eyJ1Ijoia3lsZWxlMzIyMSIsImEiOiJjbWh5a2tiN3AwZGEyMmtvbWt1M3NmbWpwIn0.jzjnBS1_Hf0fLheOMe33PA';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v12',
  center: [-71.09415, 42.36027],
  zoom: 12,
  minZoom: 5,
  maxZoom: 18
});

map.addControl(new mapboxgl.NavigationControl(), 'top-right');

const svg = d3.select('#map').select('svg');

function getCoords(station) {
  const lon = +(station.Long ?? station.lon ?? station.longitude);
  const lat = +(station.Lat ?? station.lat ?? station.latitude);
  const p = map.project(new mapboxgl.LngLat(lon, lat));
  return { cx: p.x, cy: p.y };
}

function formatTime(minutes) {
  const date = new Date(0, 0, 0, 0, minutes);
  return date.toLocaleString('en-US', { timeStyle: 'short' });
}

function minutesSinceMidnight(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function filterTripsbyTime(trips, timeFilter) {
  return timeFilter === -1
    ? trips
    : trips.filter(trip => {
        const s = minutesSinceMidnight(trip.started_at);
        const e = minutesSinceMidnight(trip.ended_at);
        return Math.abs(s - timeFilter) <= 60 || Math.abs(e - timeFilter) <= 60;
      });
}

function computeStationTraffic(stations, trips) {
  const departures = d3.rollup(trips, v => v.length, d => d.start_station_id);
  const arrivals = d3.rollup(trips, v => v.length, d => d.end_station_id);
  return stations.map(station => {
    const id = station.short_name ?? station.Number ?? station.number ?? station.id;
    const a = arrivals.get(id) ?? 0;
    const d = departures.get(id) ?? 0;
    station.arrivals = a;
    station.departures = d;
    station.totalTraffic = a + d;
    return station;
  });
}

let timeFilter = -1;
let stations = [];
let trips = [];
let circles;
let radiusScale;
const stationFlow = d3.scaleQuantize().domain([0, 1]).range([0, 0.5, 1]);

map.on('load', async () => {
  const laneStyle = {
    'line-color': '#32D400',
    'line-width': 5,
    'line-opacity': 0.6
  };

  map.addSource('boston_route', {
    type: 'geojson',
    data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson'
  });

  map.addLayer({
    id: 'bike-lanes-boston',
    type: 'line',
    source: 'boston_route',
    paint: laneStyle
  });

  map.addSource('cambridge_route', {
    type: 'geojson',
    data: 'https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson'
  });

  map.addLayer({
    id: 'bike-lanes-cambridge',
    type: 'line',
    source: 'cambridge_route',
    paint: laneStyle
  });

  const jsonData = await d3.json('https://dsc106.com/labs/lab07/data/bluebikes-stations.json');
  stations = jsonData.data.stations;

  trips = await d3.csv('https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv', t => {
    t.started_at = new Date(t.started_at);
    t.ended_at = new Date(t.ended_at);
    return t;
  });

  stations = computeStationTraffic(stations, trips);

  radiusScale = d3
    .scaleSqrt()
    .domain([0, d3.max(stations, d => d.totalTraffic)])
    .range([0, 25]);

  circles = svg
    .selectAll('circle')
    .data(stations, d => d.short_name ?? d.Number)
    .enter()
    .append('circle')
    .attr('stroke', 'white')
    .attr('stroke-width', 1)
    .attr('fill-opacity', 0.6)
    .attr('opacity', 0.9)
    .attr('r', d => radiusScale(d.totalTraffic))
    .style('--departure-ratio', d => stationFlow((d.totalTraffic ? d.departures / d.totalTraffic : 0)))
    .each(function (d) {
      d3.select(this)
        .append('title')
        .text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);
    });

  function updatePositions() {
    circles
      .attr('cx', d => getCoords(d).cx)
      .attr('cy', d => getCoords(d).cy);
  }

  function updateScatterPlot(tf) {
    const filteredTrips = filterTripsbyTime(trips, tf);
    const filteredStations = computeStationTraffic(stations, filteredTrips);
    const maxT = d3.max(filteredStations, d => d.totalTraffic) || 0;
    radiusScale.domain([0, maxT]);
    tf === -1 ? radiusScale.range([0, 25]) : radiusScale.range([3, 50]);
    circles
      .data(filteredStations, d => d.short_name ?? d.Number)
      .join('circle')
      .attr('stroke', 'white')
      .attr('stroke-width', 1)
      .attr('fill-opacity', 0.6)
      .attr('opacity', 0.9)
      .attr('r', d => radiusScale(d.totalTraffic))
      .style('--departure-ratio', d => stationFlow((d.totalTraffic ? d.departures / d.totalTraffic : 0)))
      .each(function (d) {
        const t = d3.select(this).select('title');
        (t.empty() ? d3.select(this).append('title') : t)
          .text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);
      });
    updatePositions();
  }

  updatePositions();
  map.on('move', updatePositions);
  map.on('zoom', updatePositions);
  map.on('resize', updatePositions);
  map.on('moveend', updatePositions);

  const timeSlider = document.getElementById('timeSlider');
  const selectedTime = document.getElementById('timeValue');
  const anyTimeLabel = document.getElementById('anytime');

  function updateTimeDisplay() {
    timeFilter = Number(timeSlider.value);
    if (timeFilter === -1) {
      selectedTime.textContent = '';
      anyTimeLabel.style.display = 'block';
    } else {
      selectedTime.textContent = formatTime(timeFilter);
      anyTimeLabel.style.display = 'none';
    }
    updateScatterPlot(timeFilter);
  }

  timeSlider.addEventListener('input', updateTimeDisplay);
  updateTimeDisplay();
});
