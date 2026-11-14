// Worker thread: terrain horizon elevation for a band of map rows.
// For every map cell (its centre) and every one of AZ compass directions, walk outward along the great circle and keep the
// largest elevation angle at which terrain is seen, on a SPHERICAL Moon (so the curved horizon is handled, not just a flat plane):
//   elevation = atan2( r2*cos(theta) - r1 , r2*sin(theta) )   r1 = observer radius, r2 = terrain radius, theta = angular distance
// Encoded to one byte: (elevationDeg - horMin) / (horMax - horMin) * 255.
import { parentPort, workerData } from 'node:worker_threads';
import { makeHeightSampler, MOON_R_M } from './lib/lola-dem.mjs';

const { demSab, outSab, W, H, AZ, rowStart, rowEnd, horMin, horMax, stepsKm } = workerData;
const sample = makeHeightSampler(new Int16Array(demSab));
const out = new Uint8Array(outSab);
const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const R = MOON_R_M / 1000;                                   // km
const sinT = new Float64Array(stepsKm.length), cosT = new Float64Array(stepsKm.length);
stepsKm.forEach((d, k) => { sinT[k] = Math.sin(d / R); cosT[k] = Math.cos(d / R); });
const sinA = [], cosA = [];
for (let a = 0; a < AZ; a++) { sinA.push(Math.sin((a * 2 * Math.PI) / AZ)); cosA.push(Math.cos((a * 2 * Math.PI) / AZ)); }
const scale = 255 / (horMax - horMin);

for (let j = rowStart; j < rowEnd; j++) {
  const lat = 90 - ((j + 0.5) * 180) / H, phi = lat * D2R, sp = Math.sin(phi), cp = Math.cos(phi);
  for (let i = 0; i < W; i++) {
    const lon = -180 + ((i + 0.5) * 360) / W;
    const r1 = R + sample(lat, lon) / 1000;
    for (let a = 0; a < AZ; a++) {
      let best = -90;
      for (let k = 0; k < stepsKm.length; k++) {
        const st = sinT[k], ct = cosT[k];
        const sp2 = Math.max(-1, Math.min(1, sp * ct + cp * st * cosA[a]));
        const lat2 = Math.asin(sp2) * R2D;
        const dlon = Math.atan2(sinA[a] * st * cp, ct - sp * sp2) * R2D;
        const r2 = R + sample(lat2, lon + dlon) / 1000;
        const el = Math.atan2(r2 * ct - r1, r2 * st) * R2D;
        if (el > best) best = el;
      }
      const v = Math.round((best - horMin) * scale);
      out[(a * H + j) * W + i] = v < 0 ? 0 : v > 255 ? 255 : v;
    }
  }
  parentPort.postMessage({ row: j });
}
parentPort.postMessage({ done: true });
