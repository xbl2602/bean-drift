// 南极（80°S 到极点）160 m 高精度地形：读 pipeline 打包的数据（public/data/polar-v1/，见 pipeline/build-polar-package.mjs），
// 给单点查询提供高度、坡度、坡向，并现算该点的地平线剖面（不存地平线：90 个方位的整圈地平线要约 1 GB，放不下）。
//
// 数据在极射赤面投影图上（见 manifest.json 的 projection）：经度 0 在图的上方，90°E 在右方，极点在图正中。
// 高度图和坡度图是压缩文件，第一次用到时解压进内存（约 43 MB）。
//
// 关于"模块级缓存"：AGENTS.md 5.3 禁止服务端用模块级可变变量存【会变的状态】。这里缓存的是不可变的常量数据（同一份文件解出来的数组，
// 各个实例解出来完全一样，从不被修改，实例被回收后重新解压即可），不会让不同实例结果不一致。每个请求都重新解压要多花约 0.3 秒。
// 这个文件只负责读和算，选不选它由 terrain-source-routing.ts 决定（别处不要直接 import 这个文件）。
import { readFileSync } from "node:fs";
import path from "node:path";
import { brotliDecompressSync } from "node:zlib";

export interface PolarManifest {
  grid: { sizeCells: number; cellM: number; centreCell: number };
  projection: { moonRadiusM: number };
  height: { file: string; heightUnitM: number; outsideValue: number };
  slope: { file: string; stepDeg: number; noValue: number };
  horizon: { azimuths: number; rayMaxKm: number };
}

export interface PolarGrid {
  manifest: PolarManifest;
  /** 高度，半米为单位（乘 heightUnitM 得米），outsideValue = 不在 80°S 圈内。 */
  heights: Int16Array;
  /** 坡度，每格一个字节（乘 stepDeg 得度），noValue = 没有值。 */
  slopes: Uint8Array;
}

/** 和 precomputed-maps.ts 的 TerrainSample 字段一致（那个文件只准 terrain-source-routing 引用，所以这里单独写一份）。 */
export interface PolarTerrainSample {
  heightM: number;
  slopeDeg: number;
  aspectDeg: number | null;
  resolutionM: number;
}

/** 极区数据负责的范围：南纬这个值以南（含）。pipeline 里的 POLAR_EDGE_RADIUS_M 就是这条纬线。 */
export const POLAR_COVERAGE_NORTH_LATDEG = -80;

const FLAT_GRADIENT = 1e-4; // 平均坡度小于约 0.006° 时，下坡方向没有意义（和 pipeline/build-polar-terrain.mjs 一致）
const DEG = Math.PI / 180;

/** 射线取样距离（km）：近处每格一个样，远处逐渐放稀。最远 300 km，和全月地平线一致。 */
const RAY_STEPS_KM: readonly number[] = (() => {
  const steps: number[] = [];
  for (let d = 0.16; d <= 2.56 + 1e-9; d += 0.16) steps.push(d);
  for (let d = 2.88; d <= 10 + 1e-9; d += 0.32) steps.push(d);
  for (let d = 11; d <= 60; d += 1) steps.push(d);
  for (let d = 62; d <= 160; d += 2) steps.push(d);
  for (let d = 164; d <= 300; d += 4) steps.push(d);
  return steps;
})();

/** 数据目录。Vercel 上由 next.config.ts 的 outputFileTracingIncludes 把这些文件打进函数包。 */
function polarDataDir(): string {
  return path.join(process.cwd(), "public", "data", "polar-v1");
}

function isPolarManifest(value: unknown): value is PolarManifest {
  const m = value as PolarManifest | null;
  return Boolean(
    m &&
      Number.isFinite(m.grid?.sizeCells) && Number.isFinite(m.grid?.cellM) && Number.isFinite(m.grid?.centreCell) &&
      Number.isFinite(m.projection?.moonRadiusM) &&
      m.height?.file && Number.isFinite(m.height.heightUnitM) && Number.isFinite(m.height.outsideValue) &&
      m.slope?.file && Number.isFinite(m.slope.stepDeg) && Number.isFinite(m.slope.noValue) &&
      Number.isFinite(m.horizon?.azimuths) && Number.isFinite(m.horizon?.rayMaxKm),
  );
}

/** 高度：[低字节平面][高字节平面]，每行存相邻差（16 位回绕），累加还原。和 pipeline/build-polar-package.mjs 的 decodeHeights 一致。 */
function decodeHeights(planes: Buffer, sizeCells: number): Int16Array {
  const total = sizeCells * sizeCells;
  if (planes.length !== total * 2) throw new Error("polar height file has an unexpected size");
  const heights = new Int16Array(total);
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

let cachedGrid: PolarGrid | undefined;

/** 读并解压极区数据。文件缺失、损坏或格式不对时抛错，由调用方降级成"数据不可用"。 */
export function loadPolarGrid(): PolarGrid {
  if (cachedGrid) return cachedGrid;
  const dir = polarDataDir();
  const manifest: unknown = JSON.parse(readFileSync(path.join(dir, "manifest.json"), "utf8"));
  if (!isPolarManifest(manifest)) throw new Error("polar terrain manifest is missing required fields");
  const total = manifest.grid.sizeCells * manifest.grid.sizeCells;
  const heights = decodeHeights(brotliDecompressSync(readFileSync(path.join(dir, manifest.height.file))), manifest.grid.sizeCells);
  const slopes = new Uint8Array(brotliDecompressSync(readFileSync(path.join(dir, manifest.slope.file))));
  if (slopes.length !== total) throw new Error("polar slope file has an unexpected size");
  cachedGrid = { manifest, heights, slopes };
  return cachedGrid;
}

/** 极射赤面平面上的位置（米，x 向右、y 向上）。南纬 latDeg、东经 lonDeg。 */
function planePositionM(moonRadiusM: number, latDeg: number, lonDeg: number): { xM: number; yM: number; radiusM: number } {
  const radiusM = 2 * moonRadiusM * Math.tan(((90 + latDeg) * DEG) / 2);
  const lonRad = lonDeg * DEG;
  return { xM: radiusM * Math.sin(lonRad), yM: radiusM * Math.cos(lonRad), radiusM };
}

/** 格子坐标（格子中心为整数，col 向右、row 向下）。 */
function cellCoordinates(manifest: PolarManifest, latDeg: number, lonDeg: number): { col: number; row: number } {
  const { xM, yM } = planePositionM(manifest.projection.moonRadiusM, latDeg, lonDeg);
  return { col: xM / manifest.grid.cellM + manifest.grid.centreCell, row: manifest.grid.centreCell - yM / manifest.grid.cellM };
}

/**
 * 在格子坐标 (col, row) 上对四个相邻格子做双线性插值。不在 80°S 圈内的格子不参与（权重重新归一）；
 * 四个都不在圈内返回 null（这个位置不属于极区数据）。
 */
function interpolate(grid: PolarGrid, values: ArrayLike<number>, invalid: number, col: number, row: number): number | null {
  const size = grid.manifest.grid.sizeCells;
  const col0 = Math.floor(col), row0 = Math.floor(row), fx = col - col0, fy = row - row0;
  let sum = 0, weightSum = 0;
  for (let dy = 0; dy <= 1; dy++) {
    const r = row0 + dy;
    if (r < 0 || r >= size) continue;
    for (let dx = 0; dx <= 1; dx++) {
      const c = col0 + dx;
      if (c < 0 || c >= size) continue;
      const value = values[r * size + c];
      if (value === invalid) continue;
      const weight = (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy);
      sum += value * weight;
      weightSum += weight;
    }
  }
  return weightSum > 0 ? sum / weightSum : null;
}

function heightAtCellM(grid: PolarGrid, col: number, row: number): number | null {
  const dn = interpolate(grid, grid.heights, grid.manifest.height.outsideValue, col, row);
  return dn === null ? null : dn * grid.manifest.height.heightUnitM;
}

/** 某点的高度、坡度、坡向。点不在极区数据范围内（80°S 以北）时抛错——选数据源是调用方的事。 */
export function readPolarTerrainAt(grid: PolarGrid, latDeg: number, lonDeg: number): PolarTerrainSample {
  const { manifest } = grid;
  const { col, row } = cellCoordinates(manifest, latDeg, lonDeg);
  const heightM = heightAtCellM(grid, col, row);
  const slopeSteps = interpolate(grid, grid.slopes, manifest.slope.noValue, col, row);
  if (heightM === null || slopeSteps === null) throw new Error(`latitude ${latDeg}, longitude ${lonDeg} is outside the polar terrain data`);

  // 下坡方向：用点两侧各 1 格（320 m 基线）的高度差。图像坐标 -> 罗盘：北是径向向外，东是顺时针（见 pipeline/build-polar-terrain.mjs）。
  const east = heightAtCellM(grid, col + 1, row), west = heightAtCellM(grid, col - 1, row);
  const up = heightAtCellM(grid, col, row - 1), down = heightAtCellM(grid, col, row + 1);
  let aspectDeg: number | null = null;
  if (east !== null && west !== null && up !== null && down !== null) {
    const { radiusM } = planePositionM(manifest.projection.moonRadiusM, latDeg, lonDeg);
    const groundPerPlaneMetre = Math.cos(Math.atan(radiusM / (2 * manifest.projection.moonRadiusM))) ** 2;
    const baselineM = 2 * manifest.grid.cellM * groundPerPlaneMetre;
    const gradX = (east - west) / baselineM, gradY = (up - down) / baselineM;
    const sinLon = Math.sin(lonDeg * DEG), cosLon = Math.cos(lonDeg * DEG);
    const gradEast = gradX * cosLon - gradY * sinLon, gradNorth = gradX * sinLon + gradY * cosLon;
    if (Math.hypot(gradEast, gradNorth) >= FLAT_GRADIENT) aspectDeg = (((Math.atan2(-gradEast, -gradNorth) * 180) / Math.PI) + 360) % 360;
  }
  return { heightM, slopeDeg: slopeSteps * manifest.slope.stepDeg, aspectDeg, resolutionM: manifest.grid.cellM };
}

/**
 * 某点的地平线剖面：azimuths 个等间隔方位（从正北起，向东增加）上的遮挡仰角，度。算法和全月地平线（pipeline/horizon-worker.mjs）相同：
 * 在球形月球上沿大圆往外走，取"看到地形的最大仰角"，仰角是相对观察点所在球面的水平线：
 *   elevation = atan2(r2 cos(theta) - r1, r2 sin(theta))，r1 = 观察点半径，r2 = 地形点半径，theta = 两点的角距离。
 * 射线走出极区数据范围（80°S 以北）后，高度改读 outsideHeightM（全月地图，0.25°格子）。
 */
export function computePolarHorizonProfile(
  grid: PolarGrid,
  latDeg: number,
  lonDeg: number,
  outsideHeightM: (latDeg: number, lonDeg: number) => number,
  azimuths: number = grid.manifest.horizon.azimuths,
): number[] {
  const { manifest } = grid;
  const moonRadiusKm = manifest.projection.moonRadiusM / 1000;
  const heightAt = (lat: number, lon: number): number => {
    if (lat <= POLAR_COVERAGE_NORTH_LATDEG) {
      const { col, row } = cellCoordinates(manifest, lat, lon);
      const inside = heightAtCellM(grid, col, row);
      if (inside !== null) return inside;
    }
    return outsideHeightM(lat, lon);
  };

  const observerHeightM = heightAt(latDeg, lonDeg);
  const observerRadiusKm = moonRadiusKm + observerHeightM / 1000;
  // 正好在极点时，所有方向"向北"都是同一条经线，方位算不出来；偏开 0.0001°（约 3 m，远小于一个格子）。
  const rayLatDeg = Math.max(latDeg, -89.9999);
  const phi = rayLatDeg * DEG, sinPhi = Math.sin(phi), cosPhi = Math.cos(phi);
  const stepSin = RAY_STEPS_KM.map((d) => Math.sin(d / moonRadiusKm)), stepCos = RAY_STEPS_KM.map((d) => Math.cos(d / moonRadiusKm));

  const profile: number[] = [];
  for (let a = 0; a < azimuths; a++) {
    const azimuthRad = (a * 2 * Math.PI) / azimuths, sinA = Math.sin(azimuthRad), cosA = Math.cos(azimuthRad);
    let best = -90;
    for (let k = 0; k < RAY_STEPS_KM.length; k++) {
      const st = stepSin[k], ct = stepCos[k];
      const sinLat2 = Math.max(-1, Math.min(1, sinPhi * ct + cosPhi * st * cosA));
      const lat2 = (Math.asin(sinLat2) * 180) / Math.PI;
      const lon2 = lonDeg + (Math.atan2(sinA * st * cosPhi, ct - sinPhi * sinLat2) * 180) / Math.PI;
      const terrainRadiusKm = moonRadiusKm + heightAt(lat2, lon2) / 1000;
      const elevationDeg = (Math.atan2(terrainRadiusKm * ct - observerRadiusKm, terrainRadiusKm * st) * 180) / Math.PI;
      if (elevationDeg > best) best = elevationDeg;
    }
    profile.push(best);
  }
  return profile;
}
