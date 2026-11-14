// 分析图层用的"模型"公式，全项目只此一份：
//   - 地图着色器（analysis-glsl.ts）把这里的常数原样写进 GLSL；
//   - 点位数值（悬停、候选点卡片、对比、导出）直接调用这里的函数。
// 两边公式必须逐条对应；改这里就要同时改 analysis-glsl.ts。
// 这些都是估算，不是实测。每条的假设写在注释里，界面上也要标明"model"。

export const ANALYSIS_MODEL = {
  /**
   * 太阳直射、正对太阳的地面的辐射平衡温度：T = (S(1-A)/(εσ))^(1/4)。
   * S = 1361 W/m²（太阳常数），A = 0.12（月面反照率），ε = 0.95，σ = 5.67e-8  ->  约 386 K。
   */
  subsolarTempK: 386,
  /** 夜间温度：不模拟土壤蓄热，统一取一个典型值。 */
  nightTempK: 95,
  /** 永久阴影里的典型温度。 */
  shadowTempK: 55,
  /** 水冰在真空里长期稳定的大致上限；到 iceWarmTempK 以上记为 0。 */
  iceColdTempK: 110,
  iceWarmTempK: 150,
  /** 坡度评分：0° 得 1 分，线性降到 slopeLimitDeg 得 0 分。 */
  slopeLimitDeg: 15,
  /** 开启坡度项时的安全门槛：从 slopeGateStartDeg 到 slopeGateEndDeg，总分被压到 0。 */
  slopeGateStartDeg: 15,
  slopeGateEndDeg: 25,
  /** 地球在天上的位置随天平动摆动约 ±7°：平均高度角从 -7° 到 +7°，可见时间比例从 0 到 1。 */
  earthLibrationDeg: 7,
  /** 热环境评分：月内最高温 thermalMildK 以下得 1 分，到 thermalHotK 得 0 分。 */
  thermalMildK: 250,
  thermalHotK: 390,
  /** 这个纬度以上开始改用极区地平线预计算（polar-light-4k.png），到 polarFullDeg 完全切换。 */
  polarStartDeg: 80,
  polarFullDeg: 82,
  /** 太阳视半径的正弦（0.267°）：圆面上边缘露出地平线就算有光。 */
  sunRadiusSin: 0.00466,
  /** 一个朔望月里取多少个太阳位置来统计光照。GLSL 里数组长度写死为这个数。 */
  monthSamples: 24,
  synodicMonthMs: 29.530589 * 86_400_000,
  tempScaleMinK: 40,
  tempScaleMaxK: 400,
} as const;

const M = ANALYSIS_MODEL;

export type Vec3 = readonly [number, number, number];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1);
/** 和 GLSL 的 smoothstep 一致。 */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

export interface PolarLight {
  /** 最有利季节太阳上边缘高出地形地平线多少度；负数 = 永久阴影。 */
  sunMarginDeg: number;
  /** 一年里有阳光的时间比例（含地形地平线）。 */
  litFraction: number;
  /** 离最近永久阴影的接近程度，1 = 在里面，20 km 外为 0。 */
  shadowProximity: number;
}

export interface SurfacePoint {
  latDeg: number;
  /** 月固系单位向量：当地的"上"。 */
  up: Vec3;
  /** 月固系单位向量：地形法线（含坡度）。 */
  normal: Vec3;
  slopeDeg: number;
  /** 南北纬 80° 以内没有这项数据。 */
  polar: PolarLight | null;
}

export interface SiteMetrics {
  slopeDeg: number;
  /** 一个朔望月里有阳光的时间比例（极区是全年、含地形遮挡）。 */
  illuminationFraction: number;
  temperatureNowK: number;
  maxTemperatureK: number;
  permanentShadow: number;
  iceIndex: number;
  earthVisibleFraction: number;
  suitability: number;
  scores: { slope: number; sunlight: number; earth: number; ice: number; thermal: number };
}

export const equilibriumTempK = (cosIncidence: number) => M.subsolarTempK * Math.pow(Math.max(cosIncidence, 0), 0.25);

/** 太阳方向 s 下，地面受光的入射余弦；太阳在光滑球面地平线以下记 0。 */
function litCosine(point: SurfacePoint, sun: Vec3): number {
  return dot(point.up, sun) > -M.sunRadiusSin ? Math.max(dot(point.normal, sun), 0) : 0;
}

export function computeSiteMetrics(
  point: SurfacePoint,
  sunNow: Vec3,
  monthSuns: readonly Vec3[],
  weights: { slope: number; sunlight: number; earth: number; ice: number; thermal: number },
): SiteMetrics {
  const polarWeight = point.polar ? smoothstep(M.polarStartDeg, M.polarFullDeg, Math.abs(point.latDeg)) : 0;
  const permanentShadow = point.polar ? polarWeight * (1 - smoothstep(-0.3, 0.3, point.polar.sunMarginDeg)) : 0;

  let litCount = 0;
  let maxCos = 0;
  for (const sun of monthSuns) {
    const c = litCosine(point, sun);
    if (c > 1e-5) litCount++;
    maxCos = Math.max(maxCos, c);
  }
  const monthLit = litCount / monthSuns.length;
  const illuminationFraction = point.polar ? mix(monthLit, point.polar.litFraction, polarWeight) : monthLit;

  const nightTempK = mix(M.nightTempK, M.shadowTempK, permanentShadow);
  const temperatureNowK = Math.max(nightTempK, equilibriumTempK(litCosine(point, sunNow) * (1 - permanentShadow)));
  const maxTemperatureK = Math.max(nightTempK, equilibriumTempK(maxCos * (1 - permanentShadow)));

  const cold = 1 - smoothstep(M.iceColdTempK, M.iceWarmTempK, maxTemperatureK);
  const iceIndex = Math.max(permanentShadow, cold);
  const iceAccess = Math.max(iceIndex, (point.polar?.shadowProximity ?? 0) * polarWeight);

  // 地球平均位置在月固系 +x 方向（经纬 0/0 的正上方）
  const earthElevationDeg = (Math.asin(Math.min(Math.max(point.up[0], -1), 1)) * 180) / Math.PI;
  const earthVisibleFraction = smoothstep(-M.earthLibrationDeg, M.earthLibrationDeg, earthElevationDeg);

  const scores = {
    slope: clamp01(1 - point.slopeDeg / M.slopeLimitDeg),
    sunlight: illuminationFraction,
    earth: earthVisibleFraction,
    ice: iceAccess,
    thermal: 1 - smoothstep(M.thermalMildK, M.thermalHotK, maxTemperatureK),
  };
  const weightSum = weights.slope + weights.sunlight + weights.earth + weights.ice + weights.thermal;
  const weighted = weights.slope * scores.slope + weights.sunlight * scores.sunlight + weights.earth * scores.earth + weights.ice * scores.ice + weights.thermal * scores.thermal;
  const slopeGate = weights.slope > 0 ? 1 - smoothstep(M.slopeGateStartDeg, M.slopeGateEndDeg, point.slopeDeg) : 1;
  const suitability = weightSum > 0 ? (weighted / weightSum) * slopeGate : 0;

  return { slopeDeg: point.slopeDeg, illuminationFraction, temperatureNowK, maxTemperatureK, permanentShadow, iceIndex, earthVisibleFraction, suitability, scores };
}
