// Step 1: height, slope and slope direction per map cell, from the 474 m LOLA DEM.
// Each map cell is 0.25 x 0.25 deg = 16 x 16 DEM pixels. Written to public/data/v1/:
//   height-4ppd.i16   mean height of the cell, in half metres (metres = value * 0.5), above the 1737.4 km reference sphere
//   slope-4ppd.u16    mean of the per-pixel slope (degrees * 100), measured over a ~474 m baseline
//   aspect-4ppd.u16   downhill direction of the cell's mean gradient (degrees * 100, compass bearing north=0, east=90);
//                     65535 = no meaningful direction (cell is flat on average)
// Layout of every file: MAP.height rows x MAP.width columns, row 0 = north, column 0 = longitude -180.
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LDEM64, MAP, MOON_R_M, OUT_DIR, loadLdem64Shared } from './lib/lola-dem.mjs';

const BLOCK = LDEM64.ppd / MAP.ppd;                              // DEM pixels per map cell, along one side (16)
const PIXEL_M = (MOON_R_M * Math.PI) / 180 / LDEM64.ppd;         // size of one DEM pixel along a meridian, metres (~473.8)
const NO_ASPECT = 65535;
const FLAT_GRADIENT = 1e-4;                                       // below this (0.006 deg) the downhill direction is meaningless

export function buildTerrain(log = console.log) {
  const t0 = Date.now();
  const dn = new Int16Array(loadLdem64Shared());
  const { width: W, height: H, unitM } = LDEM64;
  const cells = MAP.width * MAP.height;
  const sumDn = new Float64Array(cells), sumSlope = new Float64Array(cells), sumGradE = new Float64Array(cells), sumGradN = new Float64Array(cells);

  for (let j = 0; j < H; j++) {
    const lat = 90 - (j + 0.5) / LDEM64.ppd;
    const cosLat = Math.cos((lat * Math.PI) / 180);
    // East-west pixels get shorter toward the poles; widen the baseline so it stays ~1 pixel (474 m) long on the ground.
    const stride = Math.max(1, Math.min(2048, Math.round(1 / cosLat)));
    const eastBaselineM = 2 * stride * PIXEL_M * cosLat;
    const rowNorth = (j > 0 ? j - 1 : 0) * W, rowSouth = (j < H - 1 ? j + 1 : H - 1) * W, row = j * W;
    const northBaselineM = 2 * PIXEL_M * (j > 0 && j < H - 1 ? 1 : 0.5);
    const cellRow = Math.floor(j / BLOCK) * MAP.width;
    for (let x = 0; x < W; x++) {
      const xe = x + stride >= W ? x + stride - W : x + stride, xw = x - stride < 0 ? x - stride + W : x - stride;
      const gradE = ((dn[row + xe] - dn[row + xw]) * unitM) / eastBaselineM;
      const gradN = ((dn[rowNorth + x] - dn[rowSouth + x]) * unitM) / northBaselineM;
      const cell = cellRow + Math.floor(x / BLOCK);
      sumDn[cell] += dn[row + x];
      sumSlope[cell] += Math.atan(Math.sqrt(gradE * gradE + gradN * gradN));
      sumGradE[cell] += gradE;
      sumGradN[cell] += gradN;
    }
  }

  const n = BLOCK * BLOCK;
  const height = new Int16Array(cells), slope = new Uint16Array(cells), aspect = new Uint16Array(cells);
  for (let c = 0; c < cells; c++) {
    height[c] = Math.round(sumDn[c] / n);
    slope[c] = Math.round(((sumSlope[c] / n) * 180 * 100) / Math.PI);
    const gE = sumGradE[c] / n, gN = sumGradN[c] / n;
    if (Math.hypot(gE, gN) < FLAT_GRADIENT) aspect[c] = NO_ASPECT;
    else {
      const downhillDeg = ((Math.atan2(-gE, -gN) * 180) / Math.PI + 360) % 360;
      aspect[c] = Math.min(NO_ASPECT - 1, Math.round(downhillDeg * 100));
    }
  }

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(path.join(OUT_DIR, 'height-4ppd.i16'), Buffer.from(height.buffer));
  writeFileSync(path.join(OUT_DIR, 'slope-4ppd.u16'), Buffer.from(slope.buffer));
  writeFileSync(path.join(OUT_DIR, 'aspect-4ppd.u16'), Buffer.from(aspect.buffer));
  log(`terrain done in ${((Date.now() - t0) / 1000).toFixed(0)} s`);

  let minDn = 32767, maxDn = -32768;
  for (let c = 0; c < cells; c++) { if (height[c] < minDn) minDn = height[c]; if (height[c] > maxDn) maxDn = height[c]; }
  return {
    width: MAP.width, height: MAP.height, ppd: MAP.ppd,
    files: { height: 'height-4ppd.i16', slope: 'slope-4ppd.u16', aspect: 'aspect-4ppd.u16' },
    heightUnitM: unitM, heightMinM: minDn * unitM, heightMaxM: maxDn * unitM,
    slopeScale: 100, aspectScale: 100, aspectNone: NO_ASPECT,
    demBlock: `${BLOCK}x${BLOCK} pixels of ${LDEM64.file} per cell`, pixelBaselineM: Number(PIXEL_M.toFixed(1)),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(buildTerrain());
