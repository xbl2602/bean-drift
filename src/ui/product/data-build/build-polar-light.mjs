// 极区光照预计算（离线运行一次）：用 LOLA 1/16° 高度算每个极区像素四周的"地形地平线"，
// 再和太阳一年里能到达的高度比较，得到：
//   R = 最有利季节里，太阳上边缘高出地平线最多多少度（margin）。< 0 表示全年照不到 = 永久阴影（在 1.9 km 分辨率下）
//       编码：(margin + 3) / 6，即 [-3°, +3°] -> [0, 255]
//   G = 一年里有阳光的时间比例（36 个太阳方位 × 6 个季节相位的平均；太阳圆面露出任何一点就算有光）
//   B = 离最近的永久阴影有多近：1 = 就在阴影里，线性降到 20 km 处为 0
// 只算南北纬 80° 以上；其它地方写 R=255, G=255, B=0。输出等距圆柱投影 4096x2048（和别的贴图对齐）。
//
// 这是"模型"，不是观测：分辨率约 1.9 km（小于它的坑看不到），太阳方位用极区平面近似，没有考虑地球遮挡（月食）。
//
// 用法：node build-polar-light.mjs <ldem_16_uint.tif> <输出目录> [预览图目录]
import sharp from "sharp";
import { writeFile } from "node:fs/promises";
import path from "node:path";

const R_M = 1737400;
const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;
const CELL_M = 600; // 极区平面网格间距
const HEIGHT_HALF_EXTENT_M = 470_000; // 高度网格覆盖到余纬约 15.4°（给射线留出 160 km 余量）
const RESULT_COLAT_DEG = 10;
const SUN_DECLINATION_MAX_DEG = 1.54; // 月球自转轴对黄道的倾角
const SUN_RADIUS_DEG = 0.267;
const AZIMUTHS = 36;
const SEASON_PHASES = 6;
const PROXIMITY_RANGE_M = 20_000;
const OUT_W = 4096;
const OUT_H = 2048;

const [demPath, outDir, previewDir] = process.argv.slice(2);
if (!demPath || !outDir) {
  console.error("usage: node build-polar-light.mjs <ldem_16_uint.tif> <outDir> [previewDir]");
  process.exit(1);
}

const { data, info } = await sharp(demPath, { limitInputPixels: false }).pipelineColourspace("grey16").toColourspace("grey16").raw({ depth: "ushort" }).toBuffer({ resolveWithObject: true });
const dem = new Uint16Array(data.buffer, data.byteOffset, data.length / 2);
const DEM_W = info.width;
const DEM_H = info.height;

/** 等距圆柱 DEM 双线性取高度（米）。 */
function demHeightM(latDeg, lonDeg) {
  const fx = ((lonDeg + 180) / 360) * DEM_W - 0.5;
  const fy = ((90 - latDeg) / 180) * DEM_H - 0.5;
  const x0 = Math.floor(fx);
  const y0 = Math.min(Math.max(Math.floor(fy), 0), DEM_H - 2);
  const tx = fx - x0;
  const ty = Math.min(Math.max(fy - y0, 0), 1);
  const xa = ((x0 % DEM_W) + DEM_W) % DEM_W;
  const xb = (xa + 1) % DEM_W;
  const top = dem[y0 * DEM_W + xa] * (1 - tx) + dem[y0 * DEM_W + xb] * tx;
  const bottom = dem[(y0 + 1) * DEM_W + xa] * (1 - tx) + dem[(y0 + 1) * DEM_W + xb] * tx;
  return (top * (1 - ty) + bottom * ty) / 2 - 10000;
}

// 射线步长：从 0.9 km 起每步 ×1.07，到 160 km
const stepsM = [];
for (let d = 900; d <= 160_000; d *= 1.07) stepsM.push(d);
const stepCos = stepsM.map((d) => Math.cos(d / R_M));
const stepSin = stepsM.map((d) => Math.sin(d / R_M));

/** poleSign: +1 北极，-1 南极。平面坐标 x 指向经度 0°，y 指向东经 90°（极球面投影）。 */
function computePole(poleSign) {
  const n = Math.round((HEIGHT_HALF_EXTENT_M * 2) / CELL_M) + 1;
  const half = (n - 1) / 2;
  const heights = new Float32Array(n * n);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = (i - half) * CELL_M;
      const y = (j - half) * CELL_M;
      const colat = 2 * Math.atan(Math.hypot(x, y) / (2 * R_M));
      heights[j * n + i] = demHeightM(poleSign * (90 - colat * R2D), Math.atan2(y, x) * R2D);
    }
  }
  const heightAt = (gx, gy) => {
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    if (x0 < 0 || y0 < 0 || x0 >= n - 1 || y0 >= n - 1) return NaN;
    const tx = gx - x0;
    const ty = gy - y0;
    const k = y0 * n + x0;
    return (heights[k] * (1 - tx) + heights[k + 1] * tx) * (1 - ty) + (heights[k + n] * (1 - tx) + heights[k + n + 1] * tx) * ty;
  };

  const resultRadiusM = 2 * R_M * Math.tan((RESULT_COLAT_DEG * D2R) / 2);
  const margin = new Float32Array(n * n).fill(NaN);
  const lit = new Float32Array(n * n).fill(NaN);
  const dirs = Array.from({ length: AZIMUTHS }, (_, k) => ({ cx: Math.cos((k * 2 * Math.PI) / AZIMUTHS), sy: Math.sin((k * 2 * Math.PI) / AZIMUTHS) }));
  const declinations = Array.from({ length: SEASON_PHASES }, (_, m) => SUN_DECLINATION_MAX_DEG * Math.sin((2 * Math.PI * (m + 0.5)) / SEASON_PHASES) * D2R);
  const bestDeclination = poleSign * SUN_DECLINATION_MAX_DEG * D2R;
  const horizonRad = new Float64Array(AZIMUTHS);

  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = (i - half) * CELL_M;
      const y = (j - half) * CELL_M;
      const r = Math.hypot(x, y);
      if (r > resultRadiusM) continue;
      const colat = 2 * Math.atan(r / (2 * R_M));
      const lon = Math.atan2(y, x);
      const px = Math.sin(colat) * Math.cos(lon);
      const py = Math.sin(colat) * Math.sin(lon);
      const pz = poleSign * Math.cos(colat);
      const r1 = R_M + heights[j * n + i];

      for (let k = 0; k < AZIMUTHS; k++) {
        let maxTan = -Infinity;
        for (let s = 0; s < stepsM.length; s++) {
          const h2 = heightAt(i + (dirs[k].cx * stepsM[s]) / CELL_M, j + (dirs[k].sy * stepsM[s]) / CELL_M);
          if (Number.isNaN(h2)) break;
          const r2 = R_M + h2;
          const t = (r2 * stepCos[s] - r1) / (r2 * stepSin[s]);
          if (t > maxTan) maxTan = t;
        }
        horizonRad[k] = Math.atan(maxTan);
      }

      let best = -Infinity;
      let litCount = 0;
      for (let k = 0; k < AZIMUTHS; k++) {
        const sunElevation = (decl) => Math.asin((px * dirs[k].cx + py * dirs[k].sy) * Math.cos(decl) + pz * Math.sin(decl));
        best = Math.max(best, sunElevation(bestDeclination) + SUN_RADIUS_DEG * D2R - horizonRad[k]);
        for (const decl of declinations) if (sunElevation(decl) + SUN_RADIUS_DEG * D2R > horizonRad[k]) litCount++;
      }
      margin[j * n + i] = best * R2D;
      lit[j * n + i] = litCount / (AZIMUTHS * SEASON_PHASES);
    }
  }

  return { n, half, margin, lit, proximity: proximityToShadow(margin, n) };
}

/** 两遍扫描的近似距离变换（3-4 chamfer），返回 1（在永久阴影里）到 0（20 km 以外）。 */
function proximityToShadow(margin, n) {
  const INF = 1e9;
  const dist = new Float32Array(n * n);
  for (let k = 0; k < dist.length; k++) dist[k] = margin[k] < 0 ? 0 : INF;
  const relax = (k, other, cost) => {
    if (dist[other] + cost < dist[k]) dist[k] = dist[other] + cost;
  };
  for (let j = 1; j < n - 1; j++) {
    for (let i = 1; i < n - 1; i++) {
      const k = j * n + i;
      relax(k, k - 1, 1);
      relax(k, k - n, 1);
      relax(k, k - n - 1, 1.4142);
      relax(k, k - n + 1, 1.4142);
    }
  }
  for (let j = n - 2; j > 0; j--) {
    for (let i = n - 2; i > 0; i--) {
      const k = j * n + i;
      relax(k, k + 1, 1);
      relax(k, k + n, 1);
      relax(k, k + n + 1, 1.4142);
      relax(k, k + n - 1, 1.4142);
    }
  }
  const out = new Float32Array(n * n);
  for (let k = 0; k < out.length; k++) out[k] = Math.max(0, 1 - (dist[k] * CELL_M) / PROXIMITY_RANGE_M);
  return out;
}

function samplePole(pole, field, latDeg, lonDeg) {
  const colat = (90 - Math.abs(latDeg)) * D2R;
  const r = 2 * R_M * Math.tan(colat / 2);
  const gx = (r * Math.cos(lonDeg * D2R)) / CELL_M + pole.half;
  const gy = (r * Math.sin(lonDeg * D2R)) / CELL_M + pole.half;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const tx = gx - x0;
  const ty = gy - y0;
  const k = y0 * pole.n + x0;
  const v = [field[k], field[k + 1], field[k + pole.n], field[k + pole.n + 1]].map((value, idx, all) => (Number.isNaN(value) ? all.find((a) => !Number.isNaN(a)) ?? 0 : value));
  return (v[0] * (1 - tx) + v[1] * tx) * (1 - ty) + (v[2] * (1 - tx) + v[3] * tx) * ty;
}

console.time("north");
const north = computePole(1);
console.timeEnd("north");
console.time("south");
const south = computePole(-1);
console.timeEnd("south");

const rgb = new Uint8Array(OUT_W * OUT_H * 3);
for (let y = 0; y < OUT_H; y++) {
  const latDeg = 90 - ((y + 0.5) / OUT_H) * 180;
  const pole = latDeg >= 90 - RESULT_COLAT_DEG ? north : latDeg <= -(90 - RESULT_COLAT_DEG) ? south : null;
  for (let x = 0; x < OUT_W; x++) {
    const o = (y * OUT_W + x) * 3;
    if (!pole) {
      rgb[o] = 255;
      rgb[o + 1] = 255;
      continue;
    }
    const lonDeg = ((x + 0.5) / OUT_W) * 360 - 180;
    rgb[o] = Math.round(Math.min(Math.max((samplePole(pole, pole.margin, latDeg, lonDeg) + 3) / 6, 0), 1) * 255);
    rgb[o + 1] = Math.round(Math.min(Math.max(samplePole(pole, pole.lit, latDeg, lonDeg), 0), 1) * 255);
    rgb[o + 2] = Math.round(Math.min(Math.max(samplePole(pole, pole.proximity, latDeg, lonDeg), 0), 1) * 255);
  }
}
await sharp(rgb, { raw: { width: OUT_W, height: OUT_H, channels: 3 } }).png({ compressionLevel: 9 }).toFile(path.join(outDir, "polar-light-4k.png"));

const meta = {
  file: "polar-light-4k.png",
  coverage: "latitudes poleward of 80 degrees; elsewhere R=255, G=255, B=0",
  R: "sunMarginDeg = R / 255 * 6 - 3 : best-season height of the Sun's upper limb above the terrain horizon; negative = permanently shadowed at ~1.9 km resolution",
  G: "fraction of the year with any part of the Sun's disc above the terrain horizon (36 azimuths x 6 season phases)",
  B: "proximity to the nearest permanently shadowed pixel: 1 inside, falling linearly to 0 at 20 km",
  method: "terrain horizon ray-marched to 160 km on a 600 m polar-stereographic grid resampled from LOLA ldem_16; Sun declination range +/-1.54 deg; Sun radius 0.267 deg",
  caveats: "model, not an observation; craters smaller than ~2 km are not resolved; eclipses by Earth ignored",
};
await writeFile(path.join(outDir, "polar-light-meta.json"), JSON.stringify(meta, null, 2) + "\n");

// 自检：已知的南极永久阴影坑底应为负 margin，沙克尔顿坑沿应该大部分时间有光
const checks = [
  ["Shackleton floor", -89.67, 129.78, south],
  ["Shoemaker floor", -88.1, 44.9, south],
  ["Haworth floor", -87.45, -5.17, south],
  ["Faustini floor", -87.18, 84.31, south],
  ["Shackleton rim (connecting ridge)", -89.45, -137.3, south],
  ["plain at 82S 0E", -82, 0, south],
  ["Peary floor (N)", 88.63, 24.4, north],
];
for (const [label, lat, lon, pole] of checks) {
  console.log(`${label}: margin ${samplePole(pole, pole.margin, lat, lon).toFixed(2)} deg, lit ${(samplePole(pole, pole.lit, lat, lon) * 100).toFixed(0)}%`);
}

if (previewDir) {
  for (const [name, pole] of [["north", north], ["south", south]]) {
    const img = new Uint8Array(pole.n * pole.n * 3);
    for (let k = 0; k < pole.n * pole.n; k++) {
      const shadow = pole.margin[k] < 0;
      const v = Number.isNaN(pole.lit[k]) ? 0 : pole.lit[k] * 255;
      img[k * 3] = shadow ? 0 : v;
      img[k * 3 + 1] = shadow ? 160 : v;
      img[k * 3 + 2] = shadow ? 255 : v * 0.6;
    }
    await sharp(img, { raw: { width: pole.n, height: pole.n, channels: 3 } }).extract({ left: 261, top: 261, width: 1045, height: 1045 }).png().toFile(path.join(previewDir, `polar-${name}.png`));
  }
}
console.log("done");
