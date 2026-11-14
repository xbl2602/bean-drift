// Step 2: horizon map. Output public/data/v1/horizon-4ppd.u8: (AZ+1) layers, each MAP.height x MAP.width bytes.
// Layer k = terrain horizon elevation toward compass azimuth k * 360/AZ (0 = north, 90 = east), encoded as
//   elevationDeg = HORIZON.horMinDeg + byte * (horMaxDeg - horMinDeg) / 255.
// Layer AZ repeats layer 0, so a reader can interpolate across north without wrapping.
// Values outside [horMinDeg, horMaxDeg] are clamped: a horizon lower than horMinDeg only happens on a very high summit
// looking down, and above horMaxDeg only deep inside a crater, where the Sun and Earth are never visible anyway.
import { Worker } from 'node:worker_threads';
import { writeFileSync, mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAP, OUT_DIR, loadLdem64Shared } from './lib/lola-dem.mjs';

export const HORIZON = { width: MAP.width, height: MAP.height, ppd: MAP.ppd, azimuths: 32, horMinDeg: -8, horMaxDeg: 32 };
// Ray sample distances (km): fine near the observer, coarser far away. 300 km covers every shadow that ~10 km of relief
// can cast on a sphere of this size (a 10.8 km peak is hidden beyond ~194 km, a 19 km drop from the deepest floor beyond ~262 km).
export const RAY_STEPS_KM = [];
for (let d = 0.5; d <= 5; d += 0.5) RAY_STEPS_KM.push(d);
for (let d = 6; d <= 30; d += 1) RAY_STEPS_KM.push(d);
for (let d = 32; d <= 80; d += 2) RAY_STEPS_KM.push(d);
for (let d = 84; d <= 160; d += 4) RAY_STEPS_KM.push(d);
for (let d = 168; d <= 300; d += 8) RAY_STEPS_KM.push(d);

export async function buildHorizon(log = console.log) {
  const { width: W, height: H, azimuths: AZ, horMinDeg, horMaxDeg } = HORIZON;
  const demSab = loadLdem64Shared();
  const outSab = new SharedArrayBuffer((AZ + 1) * H * W);
  const nThreads = Math.max(1, os.availableParallelism() - 2), rowsDone = { n: 0 };
  const per = Math.ceil(H / (4 * nThreads)), queue = [];
  for (let r = 0; r < H; r += per) queue.push([r, Math.min(H, r + per)]);
  const t0 = Date.now();
  await new Promise((resolve, reject) => {
    let running = 0;
    const next = () => {
      if (!queue.length) { if (running === 0) resolve(); return; }
      const [rowStart, rowEnd] = queue.shift();
      running++;
      const w = new Worker(new URL('./horizon-worker.mjs', import.meta.url), { workerData: { demSab, outSab, W, H, AZ, rowStart, rowEnd, horMin: horMinDeg, horMax: horMaxDeg, stepsKm: RAY_STEPS_KM } });
      w.on('message', (m) => { if (m.row !== undefined && ++rowsDone.n % 90 === 0) log(`  horizon rows ${rowsDone.n}/${H} (${((Date.now() - t0) / 1000).toFixed(0)} s)`); });
      w.on('error', reject);
      w.on('exit', () => { running--; next(); });
    };
    for (let k = 0; k < nThreads; k++) next();
  });
  const out = new Uint8Array(outSab);
  out.copyWithin(AZ * H * W, 0, H * W);                       // wrap layer
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(path.join(OUT_DIR, 'horizon-4ppd.u8'), out);
  log(`horizon done in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  return { ...HORIZON, file: 'horizon-4ppd.u8', layers: AZ + 1, rayMaxKm: RAY_STEPS_KM[RAY_STEPS_KM.length - 1], raySamples: RAY_STEPS_KM.length, source: 'ldem_64.img bilinear' };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(await buildHorizon());
