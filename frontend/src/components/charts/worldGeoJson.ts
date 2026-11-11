import * as echarts from 'echarts';

/**
 * Bundled World Countries GeoJSON for Apache ECharts `map: 'world'` and `geo` coordinate systems.
 * Covers major countries across North America, LATAM, Europe, APAC, Middle East, and Africa,
 * and also upgrades asynchronously from public high-resolution GeoJSON if online.
 */
export const BUNDLED_WORLD_GEOJSON = {
  type: 'FeatureCollection',
  features: [
    // North America
    {
      type: 'Feature',
      properties: { name: 'United States' },
      geometry: {
        type: 'MultiPolygon',
        coordinates: [
          [[[-124.7, 48.4], [-122.5, 37.7], [-117.1, 32.5], [-106.5, 31.8], [-97.1, 25.9], [-94.0, 29.7], [-89.0, 30.2], [-80.1, 25.2], [-81.0, 32.0], [-75.5, 35.2], [-74.0, 40.7], [-69.9, 41.7], [-67.0, 44.8], [-71.5, 45.0], [-76.3, 44.1], [-82.5, 41.7], [-84.0, 46.0], [-89.5, 48.0], [-95.1, 49.0], [-124.7, 49.0], [-124.7, 48.4]]],
          [[[-166.0, 54.0], [-166.0, 71.0], [-141.0, 70.0], [-141.0, 60.0], [-166.0, 54.0]]],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Canada' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[-141.0, 60.0], [-141.0, 70.0], [-125.0, 72.0], [-95.0, 74.0], [-78.0, 62.0], [-64.0, 60.0], [-53.0, 47.0], [-66.0, 44.0], [-75.0, 45.0], [-83.0, 42.5], [-89.5, 48.0], [-95.0, 49.0], [-124.7, 49.0], [-130.0, 54.5], [-141.0, 60.0]]],
      },
    },
    // LATAM
    {
      type: 'Feature',
      properties: { name: 'Mexico' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[-117.1, 32.5], [-106.5, 31.8], [-97.1, 25.9], [-97.0, 20.5], [-90.5, 19.8], [-86.8, 21.2], [-88.0, 18.0], [-92.2, 14.5], [-99.9, 16.8], [-105.5, 20.4], [-110.0, 23.0], [-114.5, 31.5], [-117.1, 32.5]]],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Colombia' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[-79.0, 1.5], [-77.3, 8.5], [-71.2, 12.4], [-67.0, 1.2], [-70.0, -4.2], [-75.5, -0.5], [-79.0, 1.5]]],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Brazil' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[-70.0, -4.2], [-67.0, 1.2], [-60.0, 4.5], [-51.0, 4.0], [-48.0, -1.0], [-35.0, -5.5], [-34.8, -8.0], [-38.5, -13.0], [-40.0, -20.0], [-48.5, -28.0], [-53.5, -33.7], [-57.6, -30.2], [-58.0, -20.0], [-60.0, -14.0], [-70.0, -11.0], [-73.5, -7.5], [-70.0, -4.2]]],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Argentina' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[-68.5, -22.0], [-57.6, -25.0], [-57.6, -30.2], [-58.5, -34.5], [-57.5, -38.0], [-62.0, -41.0], [-65.0, -45.0], [-68.5, -52.5], [-67.0, -55.0], [-72.0, -51.0], [-71.5, -41.0], [-70.0, -33.0], [-68.5, -22.0]]],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Chile' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[-70.5, -18.5], [-68.5, -22.0], [-70.0, -33.0], [-71.5, -41.0], [-72.0, -51.0], [-75.0, -52.0], [-73.5, -42.0], [-71.6, -33.0], [-70.5, -18.5]]],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Peru' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[-81.3, -4.5], [-75.5, -0.5], [-70.0, -4.2], [-70.0, -11.0], [-69.0, -13.0], [-70.5, -18.5], [-76.0, -14.0], [-79.0, -8.0], [-81.3, -4.5]]],
      },
    },
    // Europe
    {
      type: 'Feature',
      properties: { name: 'United Kingdom' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[-5.8, 50.0], [-5.0, 54.0], [-6.2, 58.6], [-1.8, 58.6], [1.8, 52.5], [1.4, 51.1], [-2.0, 50.5], [-5.8, 50.0]]],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Ireland' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[-10.2, 51.5], [-9.8, 54.5], [-6.0, 55.2], [-6.0, 52.2], [-10.2, 51.5]]],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'France' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[-4.8, 48.4], [2.5, 51.1], [8.2, 49.0], [7.6, 47.5], [6.8, 45.8], [7.5, 43.8], [3.1, 42.4], [-1.8, 43.4], [-1.2, 46.0], [-4.8, 48.4]]],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Germany' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[6.0, 51.0], [7.2, 53.7], [8.5, 55.0], [14.2, 54.0], [15.0, 51.0], [12.1, 50.3], [13.8, 48.5], [12.9, 47.5], [7.6, 47.5], [6.0, 49.5], [6.0, 51.0]]],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Netherlands' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[3.4, 51.3], [4.8, 53.0], [7.2, 53.3], [7.0, 51.8], [5.7, 50.8], [3.4, 51.3]]],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Sweden' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[11.1, 58.9], [12.3, 61.5], [14.5, 65.0], [20.5, 69.0], [24.1, 65.8], [20.0, 63.5], [18.5, 59.5], [16.5, 56.2], [12.8, 55.4], [11.1, 58.9]]],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Norway' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[4.8, 59.0], [5.0, 62.2], [10.5, 65.0], [16.0, 68.5], [25.0, 71.1], [31.0, 70.0], [28.5, 69.0], [20.5, 69.0], [14.5, 65.0], [11.1, 58.9], [7.0, 58.0], [4.8, 59.0]]],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Spain' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[-9.2, 43.0], [-1.8, 43.4], [3.1, 42.4], [0.5, 40.5], [-0.5, 38.0], [-5.4, 36.0], [-7.4, 37.2], [-7.0, 41.8], [-8.8, 42.0], [-9.2, 43.0]]],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Italy' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[6.8, 45.8], [12.2, 47.0], [13.8, 45.6], [12.5, 44.0], [16.2, 41.9], [18.5, 40.1], [15.6, 38.0], [12.5, 41.8], [10.0, 44.0], [7.5, 43.8], [6.8, 45.8]]],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Poland' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[14.2, 54.0], [18.6, 54.5], [23.5, 54.0], [24.0, 50.5], [22.5, 49.0], [18.8, 49.5], [15.0, 51.0], [14.2, 54.0]]],
      },
    },
    // APAC & Eurasia
    {
      type: 'Feature',
      properties: { name: 'India' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[68.2, 23.8], [71.0, 29.5], [74.5, 34.5], [79.0, 32.0], [88.2, 27.5], [96.0, 28.0], [92.5, 22.0], [88.0, 21.5], [80.3, 13.0], [77.5, 8.1], [72.8, 19.0], [68.2, 23.8]]],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'China' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[74.0, 39.5], [87.5, 49.0], [96.0, 43.0], [111.0, 45.0], [119.5, 50.0], [134.5, 48.0], [131.0, 43.0], [122.0, 40.0], [121.9, 31.2], [117.0, 23.5], [108.0, 21.5], [98.0, 25.0], [96.0, 28.0], [88.2, 27.5], [79.0, 32.0], [74.0, 39.5]]],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Japan' },
      geometry: {
        type: 'MultiPolygon',
        coordinates: [
          [[[130.0, 31.5], [131.0, 34.0], [135.5, 34.7], [139.8, 35.7], [141.0, 38.3], [141.5, 41.5], [140.0, 40.0], [136.5, 36.5], [131.0, 34.5], [130.0, 31.5]]],
          [[[140.0, 42.0], [145.5, 43.3], [142.0, 45.5], [140.0, 42.0]]],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Singapore' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[103.6, 1.15], [104.1, 1.15], [104.1, 1.5], [103.6, 1.5], [103.6, 1.15]]],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Australia' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[113.5, -22.0], [122.2, -18.0], [131.0, -12.0], [136.5, -12.2], [142.5, -10.8], [146.0, -17.0], [153.6, -28.0], [150.0, -37.5], [144.9, -38.0], [138.5, -35.0], [131.0, -31.5], [121.9, -34.0], [115.0, -34.2], [113.5, -22.0]]],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Indonesia' },
      geometry: {
        type: 'MultiPolygon',
        coordinates: [
          [[[95.3, 5.5], [105.8, -5.9], [104.0, -5.0], [95.3, 5.5]]],
          [[[106.0, -6.0], [114.5, -8.0], [114.0, -7.0], [106.0, -6.0]]],
          [[[109.0, 1.0], [118.0, 2.0], [117.0, -3.5], [111.0, -3.0], [109.0, 1.0]]],
        ],
      },
    },
    // Africa & Middle East (for full world silhouette)
    {
      type: 'Feature',
      properties: { name: 'Africa & MENA' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[-17.5, 14.7], [-6.0, 35.8], [10.5, 37.0], [32.5, 31.2], [35.0, 33.0], [48.0, 30.0], [56.0, 26.0], [59.8, 22.5], [44.0, 12.5], [51.4, 11.9], [40.9, -2.5], [40.4, -10.5], [35.0, -25.0], [28.0, -33.0], [18.4, -34.3], [14.5, -23.0], [12.0, -6.0], [9.4, 4.0], [3.4, 6.4], [-7.5, 4.4], [-13.5, 9.5], [-17.5, 14.7]]],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Northern Eurasia' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[28.5, 69.0], [42.0, 68.0], [60.0, 70.0], [90.0, 74.0], [135.0, 71.0], [170.0, 66.0], [160.0, 53.0], [134.5, 48.0], [119.5, 50.0], [87.5, 49.0], [74.0, 39.5], [52.0, 45.0], [38.0, 47.0], [24.0, 54.0], [28.5, 69.0]]],
      },
    },
  ],
};

let isWorldRegistered = false;

export function ensureWorldMapRegistered(): void {
  if (isWorldRegistered) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    echarts.registerMap('world', BUNDLED_WORLD_GEOJSON as any);
    isWorldRegistered = true;

    // Optionally upgrade to high-resolution Natural Earth GeoJSON if reachable
    fetch('https://fastly.jsdelivr.net/npm/echarts@4.9.0/map/json/world.json')
      .then((res) => (res.ok ? res.json() : null))
      .then((geoJson) => {
        if (geoJson && geoJson.features) {
          echarts.registerMap('world', geoJson);
        }
      })
      .catch(() => {
        // Offline or blocked: bundled GeoJSON remains active
      });
  } catch {
    // Ignore duplicate registration
  }
}
