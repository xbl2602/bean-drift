// Compares ephemeris.js with JPL Horizons (Moon as target, observer at the geocentre, quantities 14/15/20, fetched 2026-11-01).
// Run from anywhere:  node tools/check_ephemeris.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

// ephemeris.js is an ES module without a package "type", so load a temporary .mjs copy
const here = path.dirname(fileURLToPath(import.meta.url));
const tmp = path.join(os.tmpdir(), 'ephemeris_check.mjs');
fs.copyFileSync(path.join(here, '..', 'ephemeris.js'), tmp);
const E = await import(pathToFileURL(tmp).href);

// UTC, Horizons ObsSub-LON/LAT (sub-Earth point), SunSub-LON/LAT (sub-solar point), delta (AU)
const H = [
  ['2026-11-14T12:00:00Z', 358.080375, 3.876125, 120.523877, -1.557282, 0.00270955233968],
  ['2026-12-25T09:00:00Z', 2.298955, -3.282593, 343.555806, -1.157529, 0.00239095280431],
  ['2027-02-03T06:00:00Z', 1.697945, 4.733624, 218.762660, -0.182203, 0.00271475819444],
  ['2027-05-20T18:00:00Z', 4.168390, 6.248122, 0.737409, 1.522930, 0.00263952120439],
  ['2027-08-30T00:00:00Z', 359.147596, 0.105429, 203.612359, -0.672855, 0.00240357174073],
  ['2028-03-01T15:00:00Z', 353.375512, -6.668631, 115.824556, 0.989461, 0.00264070505965],
];
const wrap = (a) => ((a + 540) % 360) - 180;
let worst = 0, worstDist = 0;
for (const [iso, elon, elat, slon, slat, delta] of H) {
  const t = Date.parse(iso), e = E.subEarthLonLat(t), s = E.subSolarLonLat(t);
  const d = [wrap(e.lon - elon), e.lat - elat, wrap(s.lon - slon), s.lat - slat];
  const dd = (e.dist / 149597870.7 - delta) / delta;
  worst = Math.max(worst, ...d.map(Math.abs)); worstDist = Math.max(worstDist, Math.abs(dd));
  const f = d.map((v) => v.toFixed(3));
  console.log(`${iso} diff (deg): sub-Earth lon ${f[0]} lat ${f[1]} | sub-solar lon ${f[2]} lat ${f[3]} | distance ${(dd * 100).toFixed(3)}%`);
}
console.log(`worst angular difference ${worst.toFixed(3)} deg, worst distance difference ${(worstDist * 100).toFixed(3)}%`);
process.exit(worst < 0.05 && worstDist < 0.001 ? 0 : 1);
