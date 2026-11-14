// Worker thread: one-year illumination and Earth-visibility statistics for a band of map rows.
// For each cell, step through the year hour by hour and test: is the Sun visible above the terrain horizon? is the Earth?
//
// "Visible" = the UPPER LIMB of the disk is above the terrain horizon (any part of the disk shows). This is the same
// convention as NASA's LOLA average-visibility maps, so the results can be compared with them. The horizon is read at the
// azimuth of the disk centre (linear interpolation between the 32 stored azimuths).
// Runs are counted as they sit inside the year: a run that is cut by the start or end of the year counts with its cut length.
import { parentPort, workerData } from 'node:worker_threads';

const { horSab, timesSab, W, H, AZ, rowStart, rowEnd, N, horMin, horMax, outSab, moonRKm } = workerData;
const hor = new Uint8Array(horSab);
const sunDir = new Float64Array(timesSab, 0, N * 3);
const earthPos = new Float64Array(timesSab, N * 3 * 8, N * 3);
const sunR = new Float64Array(timesSab, N * 6 * 8, N);        // apparent radius of the Sun, degrees
const earthR = new Float64Array(timesSab, N * 7 * 8, N);      // apparent radius of the Earth, degrees
const out = new Uint16Array(outSab), plane = W * H, layer = H * W;
const D2R = Math.PI / 180, R2D = 180 / Math.PI, azStep = 360 / AZ, horScale = (horMax - horMin) / 255;
// sin(elevation) below this means the disk is below the lowest horizon in the table even with its radius added
const SIN_SURELY_BELOW = Math.sin((horMin - 2) * D2R);
const horDeg = new Float64Array(AZ + 1);

for (let j = rowStart; j < rowEnd; j++) {
  const phi = (90 - ((j + 0.5) * 180) / H) * D2R, sp = Math.sin(phi), cp = Math.cos(phi);
  for (let i = 0; i < W; i++) {
    const lam = (-180 + ((i + 0.5) * 360) / W) * D2R, sl = Math.sin(lam), cl = Math.cos(lam);
    const ux = cp * cl, uy = cp * sl, uz = sp, ex = -sl, ey = cl, nx = -sp * cl, ny = -sp * sl, nz = cp, base = j * W + i;
    let hMin = 1e9, hMax = -1e9;
    for (let k = 0; k <= AZ; k++) {
      const v = horMin + horScale * hor[k * layer + base];
      horDeg[k] = v;
      if (v < hMin) hMin = v;
      if (v > hMax) hMax = v;
    }
    // elevation of the disk's upper limb (deg) against the horizon toward azimuth given by (east, north) components
    const visible = (elLimbDeg, east, north) => {
      if (elLimbDeg > hMax) return 1;
      if (elLimbDeg <= hMin) return 0;
      const az = (((Math.atan2(east, north) * R2D) % 360) + 360) % 360, f = az / azStep, k = Math.floor(f), t = f - k;
      return elLimbDeg > horDeg[k] * (1 - t) + horDeg[k + 1] * t ? 1 : 0;
    };

    let nSun = 0, nEarth = 0, nBoth = 0;
    let sunPrev = -1, sunRun = 0, sunDarkSum = 0, sunDarkN = 0, sunDarkMax = 0;
    let earthPrev = -1, earthRun = 0, earthDarkMax = 0, earthLitSum = 0, earthLitN = 0;
    for (let n = 0; n < N; n++) {
      const sx = sunDir[3 * n], sy = sunDir[3 * n + 1], sz = sunDir[3 * n + 2];
      const sUp = sx * ux + sy * uy + sz * uz;
      let sunUp = 0;
      if (sUp > SIN_SURELY_BELOW) sunUp = visible(Math.asin(sUp) * R2D + sunR[n], sx * ex + sy * ey, sx * nx + sy * ny + sz * nz);

      const dx = earthPos[3 * n] - moonRKm * ux, dy = earthPos[3 * n + 1] - moonRKm * uy, dz = earthPos[3 * n + 2] - moonRKm * uz;
      const dl = Math.sqrt(dx * dx + dy * dy + dz * dz), eUp = (dx * ux + dy * uy + dz * uz) / dl;
      let earthUp = 0;
      if (eUp > SIN_SURELY_BELOW) earthUp = visible(Math.asin(eUp) * R2D + earthR[n], dx * ex + dy * ey, dx * nx + dy * ny + dz * nz);

      nSun += sunUp; nEarth += earthUp; nBoth += sunUp & earthUp;

      if (sunUp === sunPrev) sunRun++;
      else {
        if (sunPrev === 0) { sunDarkSum += sunRun; sunDarkN++; if (sunRun > sunDarkMax) sunDarkMax = sunRun; }
        sunPrev = sunUp; sunRun = 1;
      }
      if (earthUp === earthPrev) earthRun++;
      else {
        if (earthPrev === 0) { if (earthRun > earthDarkMax) earthDarkMax = earthRun; }
        else if (earthPrev === 1) { earthLitSum += earthRun; earthLitN++; }
        earthPrev = earthUp; earthRun = 1;
      }
    }
    // close the runs that are still open at the end of the year
    if (sunPrev === 0) { sunDarkSum += sunRun; sunDarkN++; if (sunRun > sunDarkMax) sunDarkMax = sunRun; }
    if (earthPrev === 0) { if (earthRun > earthDarkMax) earthDarkMax = earthRun; }
    else if (earthPrev === 1) { earthLitSum += earthRun; earthLitN++; }

    out[base] = Math.round((nSun / N) * 10000);
    out[plane + base] = Math.round((nEarth / N) * 10000);
    out[2 * plane + base] = Math.round((nBoth / N) * 10000);
    out[3 * plane + base] = sunDarkMax;
    out[4 * plane + base] = earthDarkMax;
    out[5 * plane + base] = sunDarkN ? Math.round((sunDarkSum / sunDarkN) * 4) : 0;
    out[6 * plane + base] = earthLitN ? Math.round((earthLitSum / earthLitN) * 4) : 0;
  }
  parentPort.postMessage({ row: j });
}
