// Shared helpers for the pipeline: where files live, and readers for the global LOLA DEM.
//
// Input  : data/raw/lola-global/ldem_64.img  (NASA LRO LOLA global DEM, 64 px/deg, ~474 m/px, 23040 x 11520, Int16)
//          Re-download (530,841,600 bytes): https://imbrium.mit.edu/DATA/LOLA_GDR/CYLINDRICAL/IMG/LDEM_64.IMG
//          Override the folder with the LOLA_RAW_DIR environment variable.
// Format : simple cylindrical, pixel registered, east longitude 0..360 from column 0, row 0 = +90 deg latitude,
//          height above the 1737.4 km reference sphere = DN * 0.5 m  (see the .LBL file next to the download).
// Output : public/data/v1/  (static files + manifest.json; the API and the web page read them from there).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(here, '..', '..');
export const RAW_DIR = process.env.LOLA_RAW_DIR ? path.resolve(process.env.LOLA_RAW_DIR) : path.join(REPO_ROOT, 'data', 'raw', 'lola-global');
export const OUT_DIR = path.join(REPO_ROOT, 'public', 'data', 'v1');

export const MOON_R_M = 1737400;
export const LDEM64 = { file: 'ldem_64.img', width: 23040, height: 11520, ppd: 64, unitM: 0.5 };

/** Size of one output map cell: 4 pixels per degree = 0.25 deg (about 7.6 km on the equator). */
export const MAP = { width: 1440, height: 720, ppd: 4 };

/** Reads the raw file and checks its size, so a truncated download fails loudly instead of producing garbage. */
export function readLdem64Raw() {
  const file = path.join(RAW_DIR, LDEM64.file);
  const raw = readFileSync(file);
  const expected = LDEM64.width * LDEM64.height * 2;
  if (raw.length !== expected) throw new Error(`${file} has ${raw.length} bytes, expected ${expected}. Re-download it (see the header of pipeline/lib/lola-dem.mjs).`);
  return new Int16Array(raw.buffer, raw.byteOffset, LDEM64.width * LDEM64.height);
}

/**
 * Re-centres the DEM on longitude 0 so columns run from -180 to +180 east, into a SharedArrayBuffer
 * (worker threads read it without copying). Values stay in DN (half metres) as Int16.
 */
export function loadLdem64Shared() {
  const dn = readLdem64Raw();
  const { width: W, height: H } = LDEM64;
  const sab = new SharedArrayBuffer(W * H * 2);
  const out = new Int16Array(sab);
  const half = W / 2;
  for (let j = 0; j < H; j++) {
    const row = j * W;
    out.set(dn.subarray(row + half, row + W), row);       // lon 180..360  ->  -180..0
    out.set(dn.subarray(row, row + half), row + half);    // lon 0..180    ->  0..180
  }
  return sab;
}

/** Bilinear height (metres) at (lat, lon) degrees from a re-centred Int16 DN array. Longitude wraps, latitude clamps. */
export function makeHeightSampler(dn) {
  const { width: W, height: H, ppd, unitM } = LDEM64;
  return (latDeg, lonDeg) => {
    let x = (lonDeg + 180) * ppd - 0.5, y = (90 - latDeg) * ppd - 0.5;
    x = ((x % W) + W) % W;
    if (y < 0) y = 0; else if (y > H - 1.001) y = H - 1.001;
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, x1 = x0 + 1 === W ? 0 : x0 + 1;
    const a = dn[y0 * W + x0], b = dn[y0 * W + x1], c = dn[(y0 + 1) * W + x0], d = dn[(y0 + 1) * W + x1];
    return (a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy) * unitM;
  };
}
