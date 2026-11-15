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
  /** Legacy equilibrium baseline; current temperatures use the Diviner-fit cycle below. */
  nightTempK: 95,
  // Hurley et al. (2014), doi:10.1016/j.icarus.2014.08.043, Eq. 2/4.
  thermalDayAmplitudeK: 262,
  thermalDuskK: 130,
  thermalDawnK: 95,
  thermalLatitudeDropK: 35,
  thermalRoughnessRad: 4.5 * Math.PI / 180,
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

/** Steady radiative model with a night baseline blended in radiative power, not a hard max. */
export function surfaceTemperatureK(cosIncidence: number, nightTempK: number): number {
  return Math.pow(Math.pow(nightTempK, 4) + (Math.pow(M.subsolarTempK, 4) - Math.pow(nightTempK, 4)) * clamp01(cosIncidence), 0.25);
}

// Five-point normal quadrature: unresolved facets are averaged in emitted radiance (T^4).
// This changes estimated temperatures, not just their displayed colours.
export const THERMAL_FACETS = [
  [0, 0.5333333333333333],
  [-1.355626179974266, 0.2220759220056126], [1.355626179974266, 0.2220759220056126],
  [-2.8569700138728056, 0.0112574113277207], [2.8569700138728056, 0.0112574113277207],
] as const;
export const NIGHT_COEFFICIENTS = [444.738, -448.937, 239.668, -63.8844, 8.34064, -0.423502] as const;
function nightPolynomialK(phi: number): number {
  return NIGHT_COEFFICIENTS.reduceRight((value, coefficient) => value * phi + coefficient, 0);
}

/** Continuous, periodic adaptation of the Diviner fit; not a heat-conduction solver. */
export function diurnalTemperatureK(phaseRad: number, cosLatitude: number): number {
  const tau = 2 * Math.PI;
  const phi = ((phaseRad % tau) + tau) % tau;
  const latitudeDropK = M.thermalLatitudeDropK * (clamp01(cosLatitude) - 1);
  if (phi >= Math.PI / 2 && phi <= 3 * Math.PI / 2) {
    const progress = (phi - Math.PI / 2) / Math.PI;
    // Remove the small rounded-coefficient endpoint residuals so both joins match exactly.
    const residual = mix(M.thermalDuskK - nightPolynomialK(Math.PI / 2), M.thermalDawnK - nightPolynomialK(3 * Math.PI / 2), progress);
    return nightPolynomialK(phi) + residual + latitudeDropK;
  }
  const signedPhi = phi > Math.PI ? phi - tau : phi;
  const progress = (signedPhi + Math.PI / 2) / Math.PI;
  // Match the cold pre-dawn endpoint while keeping the published daytime curve near noon.
  const baselineK = M.thermalDuskK - (M.thermalDuskK - M.thermalDawnK) * Math.pow(1 - progress, 8);
  return baselineK + M.thermalDayAmplitudeK * Math.sqrt(Math.max(0, cosLatitude * Math.cos(phi))) + latitudeDropK;
}

/** Transform the resolved facet normal to Sun-state coordinates, using the shared Sun vector. */
function thermalCoordinates(point: SurfacePoint, sun: Vec3): { phase: number; cosLatitude: number } {
  const xy = Math.hypot(sun[0], sun[1]);
  const east: Vec3 = [-sun[1] / xy, sun[0] / xy, 0];
  const north: Vec3 = [-sun[2] * sun[0] / xy, -sun[2] * sun[1] / xy, xy];
  const x = dot(point.normal, sun), y = dot(point.normal, east);
  const z = dot(point.normal, north);
  return { phase: Math.atan2(y, x), cosLatitude: Math.sqrt(Math.max(0, 1 - z * z)) };
}

export function thermalTemperatureK(point: SurfacePoint, sun: Vec3, permanentShadow: number): number {
  const { phase, cosLatitude } = thermalCoordinates(point, sun);
  let power = 0;
  for (const [offset, weight] of THERMAL_FACETS) {
    power += weight * Math.pow(diurnalTemperatureK(phase + offset * M.thermalRoughnessRad, cosLatitude), 4);
  }
  return Math.pow(mix(power, Math.pow(M.shadowTempK, 4), clamp01(permanentShadow)), 0.25);
}

/** Conservative cycle peak for the thermal/ice score, on the same temperature scale. */
function thermalPeakK(point: SurfacePoint, sun: Vec3, permanentShadow: number): number {
  const { cosLatitude } = thermalCoordinates(point, sun);
  const peakK = M.thermalDuskK + M.thermalDayAmplitudeK * Math.sqrt(cosLatitude) + M.thermalLatitudeDropK * (cosLatitude - 1);
  return Math.pow(mix(Math.pow(peakK, 4), Math.pow(M.shadowTempK, 4), clamp01(permanentShadow)), 0.25);
}

/** Fraction of the finite solar disk above a smooth horizon; avoids an artificial binary heat jump. */
export function solarDiskFraction(upCosine: number): number {
  const x = Math.max(-1, Math.min(1, upCosine / M.sunRadiusSin));
  return (Math.acos(-x) + x * Math.sqrt(Math.max(0, 1 - x*x))) / Math.PI;
}
function litCosine(point: SurfacePoint, sun: Vec3): number {
  return solarDiskFraction(dot(point.up, sun)) * Math.max(dot(point.normal, sun), 0);
}
/** Integrate the positive part between adjacent month samples instead of counting whole samples. */
export function litSegmentFraction(a: number, b: number): number {
  if (a > 0 && b > 0) return 1;
  if (a <= 0 && b <= 0) return 0;
  return Math.max(a, b) / (Math.abs(a) + Math.abs(b));
}
function lightMargin(point: SurfacePoint, sun: Vec3): number {
  return Math.min(dot(point.up, sun) + M.sunRadiusSin, dot(point.normal, sun));
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
  for (let i = 0; i < monthSuns.length; i++) {
    const sun = monthSuns[i];
    litCount += litSegmentFraction(lightMargin(point, sun), lightMargin(point, monthSuns[(i + 1) % monthSuns.length]));
  }
  const monthLit = litCount / monthSuns.length;
  const illuminationFraction = point.polar ? mix(monthLit, point.polar.litFraction, polarWeight) : monthLit;

  const temperatureNowK = thermalTemperatureK(point, sunNow, permanentShadow);
  const maxTemperatureK = thermalPeakK(point, sunNow, permanentShadow);

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
