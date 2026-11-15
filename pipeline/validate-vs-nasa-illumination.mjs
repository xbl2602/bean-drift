// 独立对照：把我们的极区太阳/地球可见性统计与 NASA LOLA 团队官方产品（Mazarico et al. 2011）
// 的平均太阳光照 (AVGVISIB_*_S) 与平均地球可见性 (AVGVISIB_*_EARTH) 逐点比对。
//
// 用法（先下载官方 IMG，见 docs/CREDITS.md 第 4 节）：
//   node pipeline/validate-vs-nasa-illumination.mjs <官方SUN.IMG> <官方EARTH.IMG> <点清单JSON> <端口>
// 点清单 JSON 格式：[{ latDeg, lonDeg, sunVisibleFraction, earthVisibleFraction }, ...]
// （可用脚本先向 /api/point 逐点请求 yearStats 生成；240 m IMG 仅覆盖 65°S 以南。）
//
// 坐标→像素：PDS 极立体投影（南纬，真比例在极点，240 m/px，参考球 1737.4 km）。
// 圈搜索实测（2026-11-15，lat −89.5° 整圈与 /api/point 互相关）确定约定：
//   sample = 3209.5 + rho_px * sin(lonEast)，line = 3209.5 − rho_px * cos(lonEast)
// 其中 rho_px = 2R·tan((90°+lat)/2)/240m。该约定下我们 40 个随机点的对照：
//   地球可见性 RMS 0.076（偏差均值 −0.006），太阳 RMS 0.036（+0.002）。
// 官方值是 18.6 年（完整章动周期）每小时一步的平均；我们的统计默认是 2030 一年，
// 两者在极区的差异主要来自年份（章动相位）与 240 m 像素 vs 逐点地平线的口径差。
import { open } from "node:fs/promises";
import { readFileSync } from "node:fs";

const [sunFile, earthFile, pointsFile, portArg] = process.argv.slice(2);
const SIZE = 6420, SCALE = 0.00004, M_PER_PIX = 240, R_KM = 1737.4, OFFSET = 3209.5;
const PORT = portArg ?? 3000;

const points = JSON.parse(readFileSync(pointsFile, "utf8"));
async function loadImg(file) {
  const fh = await open(file);
  const buf = Buffer.alloc(SIZE * SIZE * 2);
  await fh.read(buf, 0, buf.length, 0);
  await fh.close();
  return buf;
}
const sunBuf = sunFile ? await loadImg(sunFile) : null;
const earthBuf = earthFile ? await loadImg(earthFile) : null;

function pix(latDeg, lonDeg) {
  const rhoPix = (2 * R_KM * Math.tan(((90 + latDeg) / 2) * Math.PI / 180)) * 1000 / M_PER_PIX;
  const lon = lonDeg * Math.PI / 180;
  return {
    sample: Math.round(OFFSET + rhoPix * Math.sin(lon)),
    line: Math.round(OFFSET - rhoPix * Math.cos(lon)),
  };
}
function readDn(buf, line, sample) {
  if (line < 1 || sample < 1 || line > SIZE || sample > SIZE) return null;
  return buf.readInt16LE(((line - 1) * SIZE + (sample - 1)) * 2);
}

// 若清单里没有 our 值，现向本站 /api/point 取 yearStats（2030 默认）。
async function ensureOurs() {
  if (typeof points[0].sunVisibleFraction === "number") return;
  for (const p of points) {
    const res = await fetch(`http://localhost:${PORT}/api/point?latDeg=${p.latDeg}&lonDeg=${p.lonDeg}`);
    if (!res.ok) throw new Error(`/api/point ${res.status} at ${p.latDeg},${p.lonDeg}`);
    const j = await res.json();
    p.sunVisibleFraction = j.yearStats.sun.visibleFraction;
    p.earthVisibleFraction = j.yearStats.earth.visibleFraction;
  }
}
await ensureOurs();

let seSun = 0, seEarth = 0, nSun = 0, nEarth = 0;
console.log("lat      lon       NASA太阳  我们太阳 | NASA地球  我们地球");
for (const p of points) {
  const { line, sample } = pix(p.latDeg, p.lonDeg);
  const nasaS = sunBuf ? readDn(sunBuf, line, sample) * SCALE : null;
  const nasaE = earthBuf ? readDn(earthBuf, line, sample) * SCALE : null;
  const f = (v) => (v === null ? "  -  " : v.toFixed(3));
  console.log(
    `${p.latDeg.toFixed(2).padStart(7)} ${p.lonDeg.toFixed(1).padStart(8)}  ${f(nasaS)}    ${f(p.sunVisibleFraction)}   | ${f(nasaE)}    ${f(p.earthVisibleFraction)}`
  );
  if (nasaS !== null) { seSun += (nasaS - p.sunVisibleFraction) ** 2; nSun++; }
  if (nasaE !== null) { seEarth += (nasaE - p.earthVisibleFraction) ** 2; nEarth++; }
}
if (nSun) console.log(`\n太阳  RMS=${(Math.sqrt(seSun / nSun)).toFixed(3)} n=${nSun}（官方=18.6年平均 vs 我们=2030一年）`);
if (nEarth) console.log(`地球  RMS=${(Math.sqrt(seEarth / nEarth)).toFixed(3)} n=${nEarth}`);
console.log("判定：太阳可见性为永久阴影（≈0）的点必须两边一致；RMS 见上，参考文献 Mazarico et al. (2011), Icarus 211, 1066-1081。");
