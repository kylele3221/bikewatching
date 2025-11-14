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

  try {
    const jsonurl = 'https://dsc106.com/labs/lab07/data/bluebikes-stations.json';
    const jsonData = await d3.json(jsonurl);
    console.log('Loaded JSON Data:', jsonData);
    const stations = jsonData.data.stations;
    console.log('Stations Array:', stations);
  } catch (error) {
    console.error('Error loading JSON:', error);
  }
});
