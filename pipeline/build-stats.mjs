// Step 3: one-year statistics per map cell (needs horizon-4ppd.u8 from step 2).
// Output public/data/v1/stats-4ppd.u16: PLANES.length planes of MAP.height x MAP.width Uint16 (see PLANES for meaning and scale).
// The Sun and Earth positions come from src/core/ephemeris (the one ephemeris implementation in the project).
import { Worker } from 'node:worker_threads';
import { readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MOON_R_M, OUT_DIR } from './lib/lola-dem.mjs';
import { HORIZON } from './build-horizon.mjs';
import { bodyFixedSunEarth, EARTH_RADIUS_KM, SUN_RADIUS_KM } from '../src/core/ephemeris/ephemeris.ts';

export const STATS = { startUtc: '2030-01-01T00:00:00Z', hours: 8760, stepH: 1 };

/** Plane order is part of the file format. value = stored / scale. */
export const PLANES = [
  { key: 'sunFraction', unit: 'ratio 0..1', scale: 10000, meaning: 'share of the year the Sun is visible (any part of the disk above the terrain horizon)' },
  { key: 'earthFraction', unit: 'ratio 0..1', scale: 10000, meaning: 'share of the year the Earth is visible' },
  { key: 'bothFraction', unit: 'ratio 0..1', scale: 10000, meaning: 'share of the year Sun and Earth are visible at the same time' },
  { key: 'longestNoSunH', unit: 'hours', scale: 1, meaning: 'longest single stretch without Sun (power outage), L4' },
  { key: 'longestNoEarthH', unit: 'hours', scale: 1, meaning: 'longest single stretch without Earth (no direct signal), L5' },
  { key: 'meanNoSunH', unit: 'hours', scale: 4, meaning: 'mean length of all stretches without Sun in the year, L6 (0 if the Sun is never lost)' },
  { key: 'meanEarthWindowH', unit: 'hours', scale: 4, meaning: 'mean length of all unbroken stretches with Earth visible, L7 (0 if the Earth is never visible)' },
];

export async function buildStats(log = console.log) {
  const { width: W, height: H, azimuths: AZ, horMinDeg, horMaxDeg } = HORIZON, N = STATS.hours;
  const file = readFileSync(path.join(OUT_DIR, 'horizon-4ppd.u8'));
  const horSab = new SharedArrayBuffer(file.length); new Uint8Array(horSab).set(file);

  // Sun/Earth state for every hour of the year, computed once here and shared with the workers.
  const timesSab = new SharedArrayBuffer(N * 8 * 8), tv = new Float64Array(timesSab), t0 = Date.parse(STATS.startUtc);
  const D2R = Math.PI / 180;
  for (let n = 0; n < N; n++) {
    const { sunKm, earthKm } = bodyFixedSunEarth(t0 + n * 3600000);
    const sunDist = Math.hypot(...sunKm), earthDist = Math.hypot(...earthKm);
    tv.set([sunKm[0] / sunDist, sunKm[1] / sunDist, sunKm[2] / sunDist], 3 * n);
    tv.set(earthKm, N * 3 + 3 * n);
    tv[N * 6 + n] = Math.asin(SUN_RADIUS_KM / sunDist) / D2R;
    tv[N * 7 + n] = Math.asin(EARTH_RADIUS_KM / earthDist) / D2R;
  }

  const outSab = new SharedArrayBuffer(PLANES.length * W * H * 2);
  const nThreads = Math.max(1, os.availableParallelism() - 2), per = Math.ceil(H / (4 * nThreads)), queue = [];
  for (let r = 0; r < H; r += per) queue.push([r, Math.min(H, r + per)]);
  const started = Date.now(); let done = 0;
  await new Promise((resolve, reject) => {
    let running = 0;
    const next = () => {
      if (!queue.length) { if (running === 0) resolve(); return; }
      const [rowStart, rowEnd] = queue.shift(); running++;
      const w = new Worker(new URL('./stats-worker.mjs', import.meta.url), { workerData: { horSab, timesSab, outSab, W, H, AZ, rowStart, rowEnd, N, horMin: horMinDeg, horMax: horMaxDeg, moonRKm: MOON_R_M / 1000 } });
      w.on('message', () => { if (++done % 90 === 0) log(`  stats rows ${done}/${H} (${((Date.now() - started) / 1000).toFixed(0)} s)`); });
      w.on('error', reject);
      w.on('exit', () => { running--; next(); });
    };
    for (let k = 0; k < nThreads; k++) next();
  });
  writeFileSync(path.join(OUT_DIR, 'stats-4ppd.u16'), Buffer.from(new Uint8Array(outSab)));
  log(`stats done in ${((Date.now() - started) / 1000).toFixed(0)} s`);
  return {
    ...STATS, width: W, height: H, file: 'stats-4ppd.u16', planes: PLANES,
    visibleCriterion: 'upper limb of the disk above the terrain horizon (horizon at the azimuth of the disk centre)',
    ephemeris: 'src/core/ephemeris (Truncated Meeus + IAU lunar orientation, about 0.02 deg)',
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(await buildStats());
