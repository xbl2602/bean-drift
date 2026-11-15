// Polar step 1: height, slope and slope direction on a 160 m grid around the south pole (80 deg S to the pole),
// from the 40 m LOLA polar DEM. Same definitions as the whole-Moon step (build-terrain.mjs), only much finer:
//   height-polar-160m.i16   mean height of the cell, half metres (metres = value * 0.5), above the 1737.4 km sphere
//   slope-polar-160m.u16    mean of the per-pixel slope (degrees * 100), measured over an 80 m baseline (2 DEM pixels)
//   aspect-polar-160m.u16   downhill direction of the cell's mean gradient (degrees * 100, compass bearing north=0, east=90);
//                           65535 = no meaningful direction
// Layout: GRID.sizeCells x GRID.sizeCells, polar stereographic like the source (see lib/polar-dem.mjs: longitude 0 is the top of the
// image, the pole is at the exact middle). Cells whose centre lies beyond 80 deg S are outside the product:
// height = OUTSIDE_HEIGHT_DN, slope and aspect = NO_VALUE.
// Files go to data/raw/polar-work/ (git-ignored); what ships with the site is decided by the packaging step.
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { POLAR_DEM, POLAR_EDGE_RADIUS_M, POLAR_WORK_DIR, readPolarDem, groundPerPlaneMetre } from './lib/polar-dem.mjs';

const BLOCK_PX = 4;                                      // DEM pixels per output cell along one side: 4 x 40 m = 160 m
export const GRID = { sizeCells: POLAR_DEM.sizePx / BLOCK_PX, cellM: BLOCK_PX * POLAR_DEM.pixelM };
export const OUTSIDE_HEIGHT_DN = -32768, NO_VALUE = 65535;
const FLAT_GRADIENT = 1e-4;                              // below this (0.006 deg) the downhill direction is meaningless

export function buildPolarTerrain(log = console.log) {
  const startedMs = Date.now();
  const heightDn = readPolarDem(), sizePx = POLAR_DEM.sizePx, { pixelM, heightUnitM, centrePx } = POLAR_DEM, lastPx = sizePx - 1;
  const cellCount = GRID.sizeCells * GRID.sizeCells;
  const height = new Int16Array(cellCount).fill(OUTSIDE_HEIGHT_DN), slope = new Uint16Array(cellCount).fill(NO_VALUE), aspect = new Uint16Array(cellCount).fill(NO_VALUE);
  let validCells = 0, minHeightDn = 32767, maxHeightDn = -32768, slopeSumHundredthsDeg = 0;

  for (let cellRow = 0; cellRow < GRID.sizeCells; cellRow++) {
    for (let cellCol = 0; cellCol < GRID.sizeCells; cellCol++) {
      const xM = (BLOCK_PX * cellCol + (BLOCK_PX - 1) / 2 - centrePx) * pixelM, yM = (centrePx - (BLOCK_PX * cellRow + (BLOCK_PX - 1) / 2)) * pixelM;
      const radiusM = Math.hypot(xM, yM);
      if (radiusM > POLAR_EDGE_RADIUS_M) continue;
      const baselineM = 2 * pixelM * groundPerPlaneMetre(radiusM);   // real ground length of the 2-pixel central difference here
      let sumHeightDn = 0, sumSlopeRad = 0, sumGradX = 0, sumGradY = 0;
      for (let rowOffset = 0; rowOffset < BLOCK_PX; rowOffset++) {
        const pxRow = BLOCK_PX * cellRow + rowOffset, upOffset = (pxRow > 0 ? pxRow - 1 : 0) * sizePx, downOffset = (pxRow < lastPx ? pxRow + 1 : lastPx) * sizePx, rowStart = pxRow * sizePx;
        for (let colOffset = 0; colOffset < BLOCK_PX; colOffset++) {
          const pxCol = BLOCK_PX * cellCol + colOffset, westCol = pxCol > 0 ? pxCol - 1 : 0, eastCol = pxCol < lastPx ? pxCol + 1 : lastPx;
          const gradX = ((heightDn[rowStart + eastCol] - heightDn[rowStart + westCol]) * heightUnitM) / baselineM;   // rises toward the right of the image
          const gradY = ((heightDn[upOffset + pxCol] - heightDn[downOffset + pxCol]) * heightUnitM) / baselineM;     // rises toward the top of the image
          sumHeightDn += heightDn[rowStart + pxCol];
          sumSlopeRad += Math.atan(Math.hypot(gradX, gradY));
          sumGradX += gradX; sumGradY += gradY;
        }
      }
      const pixelsPerCell = BLOCK_PX * BLOCK_PX, cell = cellRow * GRID.sizeCells + cellCol;
      height[cell] = Math.round(sumHeightDn / pixelsPerCell);
      slope[cell] = Math.round(((sumSlopeRad / pixelsPerCell) * 180 * 100) / Math.PI);
      // image axes -> compass: north is radially outward (sin lon, cos lon), east is (cos lon, -sin lon)
      const sinLon = xM / radiusM, cosLon = yM / radiusM, meanGradX = sumGradX / pixelsPerCell, meanGradY = sumGradY / pixelsPerCell;
      const gradEast = meanGradX * cosLon - meanGradY * sinLon, gradNorth = meanGradX * sinLon + meanGradY * cosLon;
      if (Math.hypot(gradEast, gradNorth) >= FLAT_GRADIENT) {
        const downhillDeg = ((Math.atan2(-gradEast, -gradNorth) * 180) / Math.PI + 360) % 360;
        aspect[cell] = Math.min(NO_VALUE - 1, Math.round(downhillDeg * 100));
      }
      validCells++; slopeSumHundredthsDeg += slope[cell];
      if (height[cell] < minHeightDn) minHeightDn = height[cell];
      if (height[cell] > maxHeightDn) maxHeightDn = height[cell];
    }
  }

  mkdirSync(POLAR_WORK_DIR, { recursive: true });
  for (const [name, values] of [['height-polar-160m.i16', height], ['slope-polar-160m.u16', slope], ['aspect-polar-160m.u16', aspect]]) {
    writeFileSync(path.join(POLAR_WORK_DIR, name), Buffer.from(values.buffer));
  }
  const seconds = ((Date.now() - startedMs) / 1000).toFixed(0);
  log(`polar terrain done in ${seconds} s: ${validCells} cells inside 80 deg S, height ${minHeightDn * heightUnitM} .. ${maxHeightDn * heightUnitM} m, mean slope ${(slopeSumHundredthsDeg / validCells / 100).toFixed(2)} deg`);
  return { gridSizeCells: GRID.sizeCells, cellM: GRID.cellM, validCells, heightMinM: minHeightDn * heightUnitM, heightMaxM: maxHeightDn * heightUnitM };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(buildPolarTerrain());
