// Hourly Sun / Earth azimuth + elevation at the south pole for one year -> data/derived/sky_year.json (used by find_spot.py).
// usage: node tools/export_sky_series.mjs [start ISO] [days]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const tmp = path.join(os.tmpdir(), 'ephemeris_export.mjs');
fs.copyFileSync(path.join(here, '..', 'ephemeris.js'), tmp);
const E = await import(pathToFileURL(tmp).href);

const start = Date.parse(process.argv[2] || '2026-11-01T00:00:00Z'), days = +(process.argv[3] || 365);
const out = { start: new Date(start).toISOString(), stepHours: 1, sunAz: [], sunEl: [], earthAz: [], earthEl: [] };
for (let h = 0; h < days * 24; h++) {
  const s = E.skyAt(start + h * 3600e3);
  out.sunAz.push(+s.sun.az.toFixed(3)); out.sunEl.push(+s.sun.el.toFixed(3)); out.earthAz.push(+s.earth.az.toFixed(3)); out.earthEl.push(+s.earth.el.toFixed(3));
}
const file = path.join(here, '..', 'data', 'derived', 'sky_year.json');
fs.writeFileSync(file, JSON.stringify(out));
console.log('wrote', file, out.sunAz.length, 'samples');
