import { feature, mesh } from 'topojson-client';

let geography;

// Natural Earth 1:50m countries, bundled locally (no runtime network request).
export async function loadGeography() {
  if (!geography) geography = import('world-atlas/countries-50m.json').then(({ default: topology }) => ({
    land: feature(topology, topology.objects.land),
    borders: mesh(topology, topology.objects.countries, (a, b) => a !== b),
  }));
  return geography;
}

// Equirectangular projection onto a canvas region. Rings that cross the
// antimeridian are split so no stroke runs across the whole map.
function traceRings(ctx, geometry, project, close) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : geometry.type === 'MultiLineString' ? [geometry.coordinates] : [[geometry.coordinates]];
  for (const polygon of polygons) for (const ring of polygon) {
    if (!close) {
      ring.forEach(([lon, lat], index) => {
        const [x, y] = project(lon, lat);
        if (index === 0 || Math.abs(lon - ring[index - 1][0]) > 180) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      continue;
    }
    // Unwrap longitudes so a ring crossing ±180° stays continuous, then draw
    // copies shifted by 360° so both halves land on the map.
    const unwrapped = [];
    let offset = 0;
    ring.forEach(([lon, lat], index) => {
      if (index) { const jump = lon - ring[index - 1][0]; if (jump > 180) offset -= 360; else if (jump < -180) offset += 360; }
      unwrapped.push([lon + offset, lat]);
    });
    if (offset !== 0) { // Encircles a pole (Antarctica): close along the pole edge.
      const pole = unwrapped[0][1] < 0 ? -90 : 90;
      unwrapped.push([unwrapped.at(-1)[0], pole], [unwrapped[0][0], pole]);
    }
    const lons = unwrapped.map(point => point[0]);
    const min = Math.min(...lons), max = Math.max(...lons);
    for (const shift of [-360, 0, 360]) {
      if (max + shift < -180 || min + shift > 180) continue;
      unwrapped.forEach(([lon, lat], index) => { const [x, y] = project(lon + shift, lat); if (index) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
      ctx.closePath();
    }
  }
}

export const palette = {
  ocean: '#060a1c',
  land: '#141c3d',
  coast: 'rgba(222, 228, 255, 0.55)',
  border: 'rgba(160, 150, 230, 0.22)',
  graticule: 'rgba(150, 140, 230, 0.10)',
};

/**
 * Draws the world map. `bounds` crops to a lon/lat window (for the flat fallback);
 * omit it for the full equirectangular globe texture.
 */
export function drawMap(canvas, { land, borders }, { bounds = [-180, -90, 180, 90], transparentOcean = false } = {}) {
  const ctx = canvas.getContext('2d');
  const [west, south, east, north] = bounds;
  const { width, height } = canvas;
  const project = (lon, lat) => [((lon - west) / (east - west)) * width, ((north - lat) / (north - south)) * height];
  const scale = width / 2048;

  ctx.clearRect(0, 0, width, height);
  if (!transparentOcean) { ctx.fillStyle = palette.ocean; ctx.fillRect(0, 0, width, height); }

  ctx.strokeStyle = palette.graticule;
  ctx.lineWidth = Math.max(1, 1.2 * scale);
  ctx.beginPath();
  for (let lon = -180; lon <= 180; lon += 15) { const [x] = project(lon, 0); ctx.moveTo(x, 0); ctx.lineTo(x, height); }
  for (let lat = -75; lat <= 75; lat += 15) { const [, y] = project(0, lat); ctx.moveTo(0, y); ctx.lineTo(width, y); }
  ctx.stroke();

  ctx.beginPath();
  for (const item of land.features) traceRings(ctx, item.geometry, project, true);
  ctx.fillStyle = palette.land;
  ctx.fill('evenodd');
  ctx.strokeStyle = palette.coast;
  ctx.lineWidth = Math.max(1, 1.6 * scale);
  ctx.stroke();

  ctx.beginPath();
  traceRings(ctx, borders, project, false);
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = Math.max(0.75, 1.1 * scale);
  ctx.stroke();
}

// Area-uniform sample of points on land, used for the star-particle Earth.
export function sampleLandPoints({ land }, count) {
  const mask = document.createElement('canvas');
  mask.width = 720; mask.height = 360;
  const ctx = mask.getContext('2d', { willReadFrequently: true });
  ctx.beginPath();
  for (const item of land.features) traceRings(ctx, item.geometry, (lon, lat) => [(lon + 180) * 2, (90 - lat) * 2], true);
  ctx.fill('evenodd');
  const pixels = ctx.getImageData(0, 0, 720, 360).data;
  const points = [];
  let attempts = 0;
  while (points.length < count && attempts < count * 40) {
    attempts += 1;
    const lon = Math.random() * 360 - 180;
    const lat = (Math.asin(Math.random() * 2 - 1) * 180) / Math.PI;
    if (lat < -62) continue; // Leave Antarctica dark so the eye goes north.
    const x = Math.min(719, Math.floor((lon + 180) * 2));
    const y = Math.min(359, Math.floor((90 - lat) * 2));
    if (pixels[(y * 720 + x) * 4 + 3] > 128) points.push([lat, lon]);
  }
  return points;
}
