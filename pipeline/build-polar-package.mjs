// Polar step 2: pack the 160 m south-polar terrain into the files the website reads (public/data/polar-v1/).
//
// Input : data/raw/polar-work/height-polar-160m.i16 and slope-polar-160m.u16 (from build-polar-terrain.mjs).
// Output: public/data/polar-v1/
//   height-polar-160m.i16.br   cell height, half metres, int16. Row-wise difference (wraps in 16 bits), then split into a plane of
//                              low bytes followed by a plane of high bytes, then Brotli. Smooth terrain turns into many small
//                              differences, which is why this is 3x smaller than Brotli on the raw numbers (10 MB instead of 29 MB).
//   slope-polar-160m.u8.br     cell slope, one byte per cell in SLOPE_STEP_DEG steps (255 = no value), then Brotli.
//   manifest.json              grid, projection, units, encodings, source, sizes and SHA-256 of the decoded arrays.
// There is no aspect file: the downhill direction is derived from the heights when a point is asked for.
// There is no horizon file either: the horizon of a point is computed from the heights when it is asked for (see
// src/core/data/polar-terrain.ts); storing 90-azimuth horizons for 11 million cells would be about 1 GB.
//
// Run: node pipeline/build-polar-package.mjs   (after: node pipeline/build-polar-terrain.mjs)
// The decoder in src/core/data/polar-terrain.ts must stay in step with encodeHeights below; this script decodes its own
// output with the same steps and refuses to write anything that does not match the input.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, brotliDecompressSync, constants as zlibConstants } from 'node:zlib';
import { REPO_ROOT, MOON_R_M } from './lib/lola-dem.mjs';
import { POLAR_DEM, POLAR_WORK_DIR } from './lib/polar-dem.mjs';
import { GRID, OUTSIDE_HEIGHT_DN, NO_VALUE } from './build-polar-terrain.mjs';

export const POLAR_OUT_DIR = path.join(REPO_ROOT, 'public', 'data', 'polar-v1');
const SLOPE_STEP_DEG = 0.25, SLOPE_NONE_BYTE = 255, SLOPE_MAX_BYTE = 254;
const HEIGHT_FILE = 'height-polar-160m.i16.br', SLOPE_FILE = 'slope-polar-160m.u8.br';
export const HORIZON_AZIMUTHS = 90;

function brotli(buffer) {
  return brotliCompressSync(buffer, { params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 11, [zlibConstants.BROTLI_PARAM_LGWIN]: 24, [zlibConstants.BROTLI_PARAM_SIZE_HINT]: buffer.length } });
}
const sha256 = (typedArray) => createHash('sha256').update(Buffer.from(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength)).digest('hex');

function readWorkFile(name, ArrayType) {
  const raw = readFileSync(path.join(POLAR_WORK_DIR, name));
  const expectedBytes = GRID.sizeCells * GRID.sizeCells * ArrayType.BYTES_PER_ELEMENT;
  if (raw.length !== expectedBytes) throw new Error(`${name} has ${raw.length} bytes, expected ${expectedBytes}. Run build-polar-terrain.mjs first.`);
  return new ArrayType(raw.buffer, raw.byteOffset, GRID.sizeCells * GRID.sizeCells);
}

/** Int16 heights -> row differences -> [all low bytes][all high bytes]. */
export function encodeHeights(heights, sizeCells) {
  const total = sizeCells * sizeCells, planes = Buffer.alloc(total * 2);
  for (let row = 0; row < sizeCells; row++) {
    let previous = 0;
    for (let col = 0; col < sizeCells; col++) {
      const index = row * sizeCells + col, value = heights[index] & 0xffff, difference = (value - previous) & 0xffff;
      planes[index] = difference & 255;
      planes[total + index] = difference >> 8;
      previous = value;
    }
  }
  return planes;
}

/** Inverse of encodeHeights (the website's decoder in polar-terrain.ts does the same steps). */
export function decodeHeights(planes, sizeCells) {
  const total = sizeCells * sizeCells, heights = new Int16Array(total);
  for (let row = 0; row < sizeCells; row++) {
    let previous = 0;
    for (let col = 0; col < sizeCells; col++) {
      const index = row * sizeCells + col;
      previous = (previous + (planes[index] | (planes[total + index] << 8))) & 0xffff;
      heights[index] = (previous << 16) >> 16;
    }
  }
  return heights;
}

function encodeSlopes(slopeHundredthsDeg) {
  const bytes = new Uint8Array(slopeHundredthsDeg.length);
  let clamped = 0;
  for (let i = 0; i < bytes.length; i++) {
    if (slopeHundredthsDeg[i] === NO_VALUE) { bytes[i] = SLOPE_NONE_BYTE; continue; }
    const step = Math.round(slopeHundredthsDeg[i] / 100 / SLOPE_STEP_DEG);
    if (step > SLOPE_MAX_BYTE) clamped++;
    bytes[i] = Math.min(SLOPE_MAX_BYTE, step);
  }
  return { bytes, clamped };
}

export function buildPolarPackage(log = console.log) {
  const startedMs = Date.now(), sizeCells = GRID.sizeCells;
  const heights = readWorkFile('height-polar-160m.i16', Int16Array);
  const slopes = encodeSlopes(readWorkFile('slope-polar-160m.u16', Uint16Array));

  const heightFile = brotli(encodeHeights(heights, sizeCells));
  const slopeFile = brotli(Buffer.from(slopes.bytes));

  const decodedHeights = decodeHeights(brotliDecompressSync(heightFile), sizeCells);
  if (sha256(decodedHeights) !== sha256(heights)) throw new Error('decoded heights differ from the input; nothing written');
  if (sha256(new Uint8Array(brotliDecompressSync(slopeFile))) !== sha256(slopes.bytes)) throw new Error('decoded slopes differ from the input; nothing written');

  mkdirSync(POLAR_OUT_DIR, { recursive: true });
  writeFileSync(path.join(POLAR_OUT_DIR, HEIGHT_FILE), heightFile);
  writeFileSync(path.join(POLAR_OUT_DIR, SLOPE_FILE), slopeFile);

  let validCells = 0;
  for (let i = 0; i < heights.length; i++) if (heights[i] !== OUTSIDE_HEIGHT_DN) validCells++;
  const manifest = {
    version: 1,
    generatedUtc: new Date().toISOString(),
    name: 'south-polar-160m',
    source: 'NASA LRO LOLA south-polar DEM LDEM_80S_40M (40 m/pixel, 80 deg S to the pole), averaged 4 x 4 pixels into 160 m cells by pipeline/build-polar-terrain.mjs',
    coverage: { southOfLatDeg: -80, note: 'cells whose centre lies beyond 80 deg S are outside the product (height = outsideValue)' },
    projection: {
      type: 'polar stereographic, true scale at the south pole, sphere of radius moonRadiusM, planetocentric latitude, east longitude',
      moonRadiusM: MOON_R_M,
      equations: 'rho = 2 R tan((90 + latDeg) / 2); x = rho sin(lon), y = rho cos(lon); col = x / cellM + centreCell; row = centreCell - y / cellM (cell-centre coordinates)',
      note: 'longitude 0 is the top of the image, longitude 90 E points right',
    },
    grid: { sizeCells, cellM: GRID.cellM, centreCell: (sizeCells - 1) / 2, validCells, sourcePixelM: POLAR_DEM.pixelM },
    height: { file: HEIGHT_FILE, heightUnitM: POLAR_DEM.heightUnitM, outsideValue: OUTSIDE_HEIGHT_DN, bytes: heightFile.length, decodedSha256: sha256(heights), encoding: 'int16 -> row difference (wraps in 16 bits) -> plane of low bytes then plane of high bytes -> brotli' },
    slope: { file: SLOPE_FILE, stepDeg: SLOPE_STEP_DEG, noValue: SLOPE_NONE_BYTE, bytes: slopeFile.length, decodedSha256: sha256(slopes.bytes), meaning: 'mean over the 16 source pixels of the cell of the slope measured over an 80 m baseline', encoding: 'uint8 -> brotli' },
    horizon: { azimuths: HORIZON_AZIMUTHS, rayMaxKm: 300, note: 'computed per request from the heights, not stored' },
    limits: [
      'Slope is stored in 0.25 degree steps and capped at 63.5 degrees (the steepest cell is 59.9 degrees).',
      'Downhill direction is derived from the heights around the point (320 m baseline), not stored.',
      'The stereographic map stretches real distances by 1 / cos^2(colatitude / 2) (0.8% at 80 deg S); cell size is given in map metres.',
    ],
  };
  writeFileSync(path.join(POLAR_OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  const seconds = ((Date.now() - startedMs) / 1000).toFixed(0);
  log(`polar package done in ${seconds} s: ${HEIGHT_FILE} ${(heightFile.length / 1e6).toFixed(1)} MB, ${SLOPE_FILE} ${(slopeFile.length / 1e6).toFixed(1)} MB, ${slopes.clamped} slope cells capped`);
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildPolarPackage();
  for (const name of [HEIGHT_FILE, SLOPE_FILE, 'manifest.json']) console.log(name, statSync(path.join(POLAR_OUT_DIR, name)).size, 'bytes');
}
