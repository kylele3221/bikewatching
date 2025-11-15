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

  const jsonurl = 'https://dsc106.com/labs/lab07/data/bluebikes-stations.json';
  const jsonData = await d3.json(jsonurl);
  const stations = jsonData.data.stations;

  const trips = await d3.csv('https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv', d => ({
    ride_id: d.ride_id,
    bike_type: d.bike_type,
    started_at: new Date(d.started_at),
    ended_at: new Date(d.ended_at),
    start_station_id: d.start_station_id,
    end_station_id: d.end_station_id,
    is_member: +d.is_member
  }));

  const departures = d3.rollup(trips, v => v.length, d => d.start_station_id);
  const arrivals = d3.rollup(trips, v => v.length, d => d.end_station_id);

  stations.forEach(s => {
    const id = s.short_name ?? s.Number ?? s.number ?? s.id;
    const a = arrivals.get(id) ?? 0;
    const d = departures.get(id) ?? 0;
    s.arrivals = a;
    s.departures = d;
    s.totalTraffic = a + d;
  });

  const radiusScale = d3
    .scaleSqrt()
    .domain([0, d3.max(stations, d => d.totalTraffic)])
    .range([0, 25]);

  const circles = svg
    .selectAll('circle')
    .data(stations)
    .enter()
    .append('circle')
    .attr('fill', 'steelblue')
    .attr('stroke', 'white')
    .attr('stroke-width', 1)
    .attr('fill-opacity', 0.6)
    .attr('opacity', 0.9)
    .attr('r', d => radiusScale(d.totalTraffic));

  function updatePositions() {
    circles
      .attr('cx', d => getCoords(d).cx)
      .attr('cy', d => getCoords(d).cy);
  }

  updatePositions();
  map.on('move', updatePositions);
  map.on('zoom', updatePositions);
  map.on('resize', updatePositions);
  map.on('moveend', updatePositions);

  console.log('Radius scale domain:', radiusScale.domain());
});
