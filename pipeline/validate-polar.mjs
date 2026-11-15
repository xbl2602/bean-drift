// Polar step 3: check the packaged polar terrain (public/data/polar-v1/) against the 40 m source DEM.
//   A. Heights: for random cells the packaged height must equal the rounded mean of the 4 x 4 source pixels (the file is lossless).
//   B. Horizon: the website computes a point's horizon from the 160 m heights; here the same point is computed again straight from
//      the 40 m DEM with finer ray steps. The difference is what the 160 m averaging costs.
// Needs the raw 40 m DEM (data/raw/lola-south/ldem_80s_40m.img, see lib/polar-dem.mjs). Takes about a minute.
// Run: node --no-warnings pipeline/validate-polar.mjs
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { MOON_R_M, REPO_ROOT } from './lib/lola-dem.mjs';
import { POLAR_DEM, readPolarDem } from './lib/polar-dem.mjs';
import { computePolarHorizonProfile, loadPolarGrid } from '../src/core/data/polar-terrain.ts';

const DEG = Math.PI / 180, BLOCK = 4;
const dem = readPolarDem(), size = POLAR_DEM.sizePx, grid = loadPolarGrid(), cells = grid.manifest.grid.sizeCells;

// ---- global 0.25 deg heights, used where a ray leaves the polar map (same rule as the website) ----
const globalManifest = JSON.parse(readFileSync(path.join(REPO_ROOT, 'public', 'data', 'v1', 'manifest.json'), 'utf8'));
const globalRaw = readFileSync(path.join(REPO_ROOT, 'public', 'data', 'v1', globalManifest.terrain.files.height));
const { width: gw, height: gh, ppd } = globalManifest.grid;
const globalHeightM = (latDeg, lonDeg) => {
  const gx = (lonDeg + 180) * ppd - 0.5, gy = (90 - latDeg) * ppd - 0.5, x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
  const wrap = (x) => ((x % gw) + gw) % gw, clamp = (y) => Math.min(gh - 1, Math.max(0, y));
  const at = (row, col) => globalRaw.readInt16LE((clamp(row) * gw + wrap(col)) * 2);
  const top = at(y0, x0) * (1 - fx) + at(y0, x0 + 1) * fx, bottom = at(y0 + 1, x0) * (1 - fx) + at(y0 + 1, x0 + 1) * fx;
  return (top * (1 - fy) + bottom * fy) * globalManifest.terrain.heightUnitM;
};

// ---- A. heights ----
let heightMismatches = 0, heightChecked = 0, maxHeightDiffDn = 0;
let seed = 12345;
const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
for (let n = 0; n < 4000; n++) {
  const row = Math.floor(random() * cells), col = Math.floor(random() * cells), stored = grid.heights[row * cells + col];
  if (stored === grid.manifest.height.outsideValue) continue;
  let sum = 0;
  for (let dy = 0; dy < BLOCK; dy++) for (let dx = 0; dx < BLOCK; dx++) sum += dem[(row * BLOCK + dy) * size + col * BLOCK + dx];
  const expected = Math.round(sum / (BLOCK * BLOCK));
  heightChecked++;
  const diff = Math.abs(expected - stored);
  if (diff > maxHeightDiffDn) maxHeightDiffDn = diff;
  if (diff > 0) heightMismatches++;
}
console.log(`A. heights: ${heightChecked} random cells, ${heightMismatches} differ from the 4x4 mean of the 40 m DEM (largest difference ${maxHeightDiffDn * POLAR_DEM.heightUnitM} m)`);

// ---- B. horizon from the 40 m DEM ----
function demHeightM(latDeg, lonDeg) {
  const radiusM = 2 * MOON_R_M * Math.tan(((90 + latDeg) * DEG) / 2), lonRad = lonDeg * DEG;
  const col = (radiusM * Math.sin(lonRad)) / POLAR_DEM.pixelM + POLAR_DEM.centrePx, row = POLAR_DEM.centrePx - (radiusM * Math.cos(lonRad)) / POLAR_DEM.pixelM;
  const c0 = Math.floor(col), r0 = Math.floor(row), fx = col - c0, fy = row - r0;
  if (c0 < 0 || r0 < 0 || c0 + 1 >= size || r0 + 1 >= size || radiusM > 2 * MOON_R_M * Math.tan(10 * DEG / 2)) return null;
  const at = (r, c) => dem[r * size + c];
  return ((at(r0, c0) * (1 - fx) + at(r0, c0 + 1) * fx) * (1 - fy) + (at(r0 + 1, c0) * (1 - fx) + at(r0 + 1, c0 + 1) * fx) * fy) * POLAR_DEM.heightUnitM;
}
const fineSteps = [];
for (let d = 0.04; d <= 3; d += 0.04) fineSteps.push(d);
for (let d = 3.16; d <= 12; d += 0.16) fineSteps.push(d);
for (let d = 12.5; d <= 60; d += 0.5) fineSteps.push(d);
for (let d = 61; d <= 160; d += 1) fineSteps.push(d);
for (let d = 162; d <= 300; d += 2) fineSteps.push(d);

function bruteForceHorizon(latDeg, lonDeg, azimuths) {
  const R = MOON_R_M / 1000, r1 = R + (demHeightM(latDeg, lonDeg) ?? globalHeightM(latDeg, lonDeg)) / 1000;
  const rayLat = Math.max(latDeg, -89.9999), phi = rayLat * DEG, sp = Math.sin(phi), cp = Math.cos(phi);
  const out = [];
  for (let a = 0; a < azimuths; a++) {
    const A = (a * 2 * Math.PI) / azimuths, sinA = Math.sin(A), cosA = Math.cos(A);
    let best = -90;
    for (const d of fineSteps) {
      const st = Math.sin(d / R), ct = Math.cos(d / R), sp2 = Math.max(-1, Math.min(1, sp * ct + cp * st * cosA));
      const lat2 = (Math.asin(sp2) * 180) / Math.PI, lon2 = lonDeg + (Math.atan2(sinA * st * cp, ct - sp * sp2) * 180) / Math.PI;
      const h = (lat2 <= -80 ? demHeightM(lat2, lon2) : null) ?? globalHeightM(lat2, lon2);
      const r2 = R + h / 1000, el = (Math.atan2(r2 * ct - r1, r2 * st) * 180) / Math.PI;
      if (el > best) best = el;
    }
    out.push(best);
  }
  return out;
}

const POINTS = [
  ['south pole', -90, 0], ['Shackleton rim', -89.9, 129.8], ['Shackleton centre', -89.67, 129.78], ['Haworth', -87.5, -5], ['Malapert', -85.9, 12.9],
  ['Ridge A', -89.71, 62.5], ['Ridge B', -89.61, 75.8], ['Mons Mouton', -84.6, 31], ['Cabeus', -85.33, -42.13], ['Nobile', -85.28, 53.27],
  ['edge 80 S (lon 40)', -80, 40], ['edge 80 S (lon 200)', -80.05, -160], ['edge 80 S (lon 300)', -80.2, -60],
];
console.log('B. horizon, 160 m on-demand vs 40 m brute force (degrees)');
let worstMax = 0, sumMean = 0;
for (const [name, lat, lon] of POINTS) {
  const azimuths = grid.manifest.horizon.azimuths;
  const fast = computePolarHorizonProfile(grid, lat, lon, globalHeightM), slow = bruteForceHorizon(lat, lon, azimuths);
  const diffs = fast.map((v, i) => Math.abs(v - slow[i])), maxDiff = Math.max(...diffs), meanDiff = diffs.reduce((s, v) => s + v, 0) / diffs.length;
  worstMax = Math.max(worstMax, maxDiff); sumMean += meanDiff;
  console.log(`  ${name.padEnd(22)} highest horizon ${Math.max(...slow).toFixed(2).padStart(6)} (160 m: ${Math.max(...fast).toFixed(2).padStart(6)})  mean |diff| ${meanDiff.toFixed(3)}  max |diff| ${maxDiff.toFixed(3)}`);
}
console.log(`  summary: mean of mean |diff| ${(sumMean / POINTS.length).toFixed(3)} deg, worst single azimuth ${worstMax.toFixed(2)} deg`);
