// Shared helpers for the south-polar high-resolution maps (80 deg S to the pole).
//
// Input  : data/raw/lola-south/ldem_80s_40m.img  (NASA LRO LOLA south-polar DEM LDEM_80S_40M, 15200 x 15200 Int16, 40 m/pixel)
//          Re-download (462,080,000 bytes; the server is slow on one connection, so use several byte ranges at once):
//          https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/IMG/LDEM_80S_40M.IMG   (label: same name with .LBL)
//          Override the folder with the LOLA_POLAR_RAW_DIR environment variable (registered in .env.example).
// Format : polar stereographic on a sphere of radius 1737.4 km, true scale at the pole, planetocentric, east longitude.
//          Height above the 1737.4 km sphere = DN * 0.5 m. The pole sits exactly between the four middle pixels.
//
// Image layout (checked against the global 474 m DEM at 60000 random points between 80 and 90 deg S: correlation 1.0000,
// RMS difference 12 m; the 7 other possible layouts all scored below 0.4). With x to the right and y up, and rho = the distance
// from the pole in the map plane (metres):
//     x = rho * sin(lon)      y = rho * cos(lon)      rho = 2 R tan((90 deg - |lat|) / 2)
//     column = centrePx + x / pixelM      row = centrePx - y / pixelM
// So longitude 0 points up in the image, longitude 90 E points right. Compass north = radially outward, east = clockwise.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, MOON_R_M } from './lola-dem.mjs';

export const POLAR_RAW_DIR = process.env.LOLA_POLAR_RAW_DIR ? path.resolve(process.env.LOLA_POLAR_RAW_DIR) : path.join(REPO_ROOT, 'data', 'raw', 'lola-south');
/** Intermediate files of the polar steps (git-ignored together with the rest of data/raw). */
export const POLAR_WORK_DIR = process.env.LOLA_POLAR_WORK_DIR ? path.resolve(process.env.LOLA_POLAR_WORK_DIR) : path.join(REPO_ROOT, 'data', 'raw', 'polar-work');

export const POLAR_DEM = { file: 'ldem_80s_40m.img', sizePx: 15200, pixelM: 40, heightUnitM: 0.5, centrePx: 7599.5 };
/** Outer edge of the product: 80 deg S, a circle of this radius around the pole (metres in the map plane). */
export const POLAR_EDGE_RADIUS_M = 2 * MOON_R_M * Math.tan((10 * Math.PI) / 360);

export function readPolarDem() {
  const file = path.join(POLAR_RAW_DIR, POLAR_DEM.file);
  const raw = readFileSync(file);
  const expectedBytes = POLAR_DEM.sizePx * POLAR_DEM.sizePx * 2;
  if (raw.length !== expectedBytes) throw new Error(`${file} has ${raw.length} bytes, expected ${expectedBytes}. Re-download it (see the header of pipeline/lib/polar-dem.mjs).`);
  return new Int16Array(raw.buffer, raw.byteOffset, POLAR_DEM.sizePx * POLAR_DEM.sizePx);
}

/** Map-plane position (metres, x right / y up from the pole) -> latitude and east longitude in degrees. */
export function planeToLatLon(xM, yM) {
  const radiusM = Math.hypot(xM, yM);
  const colatDeg = (2 * Math.atan(radiusM / (2 * MOON_R_M)) * 180) / Math.PI;
  return { latDeg: colatDeg - 90, lonDeg: radiusM === 0 ? 0 : (Math.atan2(xM, yM) * 180) / Math.PI };
}

/** Latitude / east longitude (degrees, south hemisphere) -> map-plane position in metres. */
export function latLonToPlane(latDeg, lonDeg) {
  const radiusM = 2 * MOON_R_M * Math.tan((((90 + latDeg) * Math.PI) / 180) / 2), lonRad = (lonDeg * Math.PI) / 180;
  return { xM: radiusM * Math.sin(lonRad), yM: radiusM * Math.cos(lonRad) };
}

/** Real ground length of one map-plane metre: the stereographic map stretches by 1 / cos^2(colatitude / 2) away from the pole. */
export function groundPerPlaneMetre(radiusM) {
  const halfColatRad = Math.atan(radiusM / (2 * MOON_R_M));
  return Math.cos(halfColatRad) ** 2;
}
