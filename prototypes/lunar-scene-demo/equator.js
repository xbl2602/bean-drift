// The equatorial place: the Apollo 11 landing area in Mare Tranquillitatis (0.67 N, 23.47 E), from the LROC NAC stereo terrain model
// at 2 m/px (tools/export_apollo11.py cuts it to a 4.2 km x 8 km window around the landing site).
//
// Scene frame: x = east, y = up, z = south, the camera at the origin, the DTM sitting under it (shifted by the spot offset).
// The strip is only 4.2 km wide and the landing site is 1.2 km from its east edge, so past the edge the ground is synthetic: the
// regional height continues, with gentle swells and hashed craters, blended in over a few hundred metres. The horizon at eye height
// is 2.4 km away, so that is mostly out of sight, but it is not real data and PROJECT_CONTEXT.md says so.
import { createDemGrid, horizonProfile } from './demgrid.js';
import { EYE, fbm } from './common.js';
import { LUNAR_SKY, LUNAR_VIEW } from './sites.js';
import * as EPH from './ephemeris.js';

const R_MOON = 1737400, D2R = Math.PI / 180;
const SITE = { lat: 0.67416, lon: 23.47314 };                  // must match tools/export_apollo11.py
const FADE_IN = 60, FADE_OUT = 220;                            // m: the blend to synthetic ground starts this far inside the data edge, ends this far outside
const SHADOW = { n: 1024, px: 8 };                             // far-shadow grid: +-4 km around the camera

// camera offsets from the landing site (east, south), metres. "mid" = the middle of the strip: the whole horizon disc is real data
export const SPOTS = { mid: { x: -950, z: 0 } };

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const ihash = (a, b, s) => { let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263) ^ Math.imul(s, 1442695041); h = Math.imul(h ^ (h >>> 13), 1103515245); h ^= h >>> 16; return (h >>> 0) / 4294967296; };

// synthetic ground for where there is no data: one hashed crater per 150 m cell (70% of cells), bowl + low rim
const CELL = 150;
const synthCraters = (X, Z) => {
  const ci = Math.floor(X / CELL), cj = Math.floor(Z / CELL);
  let h = 0;
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
    const i = ci + di, j = cj + dj;
    if (ihash(i, j, 1) > 0.7) continue;
    const R = 6 + 55 * Math.pow(ihash(i, j, 2), 3), x = Math.hypot(X - (i + ihash(i, j, 3)) * CELL, Z - (j + ihash(i, j, 4)) * CELL) / R;
    if (x > 1.4) continue;
    const d = R * (0.09 + 0.05 * ihash(i, j, 5)), rim = 0.045 * R * Math.exp(-(((x - 1) / 0.16) ** 2));
    h += x < 1 ? -d * (1 - x * x) * (1 - 0.35 * x * x) + rim : rim;
  }
  return h;
};

export async function loadApollo11(spotKey, status = () => {}) {
  const spot = SPOTS[spotKey] || { x: 0, z: 0 }, ox = spot.x, oz = spot.z;
  status('loading Apollo 11 DTM…');
  const meta = await (await fetch('data/derived/apollo11_meta.json')).json();
  const raw = new Int16Array(await (await fetch('data/derived/apollo11_dem.i16')).arrayBuffer());
  status('DTM mip pyramid…');
  await new Promise((r) => setTimeout(r, 16));
  const grid = createDemGrid({ data: raw, nx: meta.nx, nz: meta.nz, px: meta.px, x0: meta.x0, z0: meta.z0, scale: meta.scale });
  const xMin = meta.x0, xMax = meta.x0 + (meta.nx - 1) * meta.px, zMin = meta.z0, zMax = meta.z0 + (meta.nz - 1) * meta.px;

  // height at (X, Z) in the landing-site frame
  const siteHeight = (X, Z, spacing) => {
    const inside = Math.min(X - xMin, xMax - X, Z - zMin, zMax - Z);        // > 0 inside the data rectangle
    const dem = grid.sample(X, Z, spacing);
    if (inside >= FADE_IN) return dem;
    const w = smooth((FADE_IN - inside) / (FADE_IN + FADE_OUT));
    const regional = grid.sample(clamp(X, xMin + FADE_IN, xMax - FADE_IN), clamp(Z, zMin + FADE_IN, zMax - FADE_IN), 96);
    const synth = (fbm(X / 260 + 40, Z / 260 + 40, 4, 3) - 0.5) * 3 + synthCraters(X, Z);
    return dem + (regional + synth - dem) * w;
  };
  const base = (x, z, spacing) => siteHeight(x + ox, z + oz, spacing);       // x, z: metres from the camera

  status('horizon + shadow grid…');
  await new Promise((r) => setTimeout(r, 16));
  const horizon = horizonProfile(base, 0, 0, { eye: EYE, px: meta.px, R: R_MOON, maxDist: 9000 });
  const { n, px } = SHADOW, x0 = -(n * px) / 2 + px / 2, dem = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) dem[j * n + i] = base(x0 + i * px, x0 + j * px, px);

  // camera position on the Moon (the DTM frame is metric east/south of the landing site)
  const lat = SITE.lat - oz / R_MOON / D2R, lon = SITE.lon + ox / (R_MOON * Math.cos(SITE.lat * D2R)) / D2R;
  return {
    id: 'apollo11',
    hudLabel: `REAL LROC NAC DTM (2 m)${spotKey && SPOTS[spotKey] ? ' · spot ' + spotKey : ''}`,
    label: `Apollo 11 · ${lat.toFixed(3)}°N ${lon.toFixed(3)}°E`,
    camera: { ...LUNAR_VIEW, yaw: 0, pitch: 3, eye: EYE },
    sun: { az: 90, el: 15 }, earth: LUNAR_SKY.earth, skyRadius: LUNAR_SKY.skyRadius,
    build: { terrain: { rMax: 9000, rings: 480, segs: 720, base, maxFeatureR: 3, curvature: R_MOON, craterDensity: 0.5, relief: 0.45 }, rocks: 300, pebbles: 700 },
    far: { lit0: new Uint8Array(n * n).fill(255), litW: n, litH: n, bounds: [-(n * px) / 2, -(n * px) / 2, n * px], dem, n, px, x0, z0: x0 },
    horizon,
    sky: (ms) => EPH.skyAtLonLat(ms, lat, lon),
    shadowSun: (ms) => EPH.skyAtLonLat(ms, lat, lon).sun,
    defaultT: Date.UTC(2026, 10, 16, 0, 0),                     // Sun 11 deg up in the east: the same height as at the Apollo 11 landing
    elRange: 90,                                                  // the Sun swings from -90 to +90 over a lunar day
    exposure: () => 1,
    starGain: (el) => 1 - 0.65 * smooth((el - 2) / 28),           // stars fade (but do not vanish) when the Sun is high
  };
}
