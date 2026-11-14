// 太阳和地球在月面任意一点的天空中的位置（给定 UTC 时间）。
// 移植自 prototypes/lunar-scene-demo/ephemeris.js（那里已用 tools/check_ephemeris.mjs 对照 JPL Horizons 校验，
// 误差约 0.02°）。算法：截断的 Meeus 月球理论 + 低精度太阳 + IAU 月球姿态（WGCCRE 2009，LOLA 用的 Mean-Earth/polar-axis 框架）。
// 适合可视化光照和通信窗口，不适合任务级规划。
//
// 这是全项目唯一的星历实现（DATA_FLOW 规则 2）：别处不要再写一份。
// 坐标系：EQJ = J2000 赤道系；Body = 月固系（x 指向经纬 0/0，y 指向东经 90°，z 指向北）。

type Vec3 = readonly [number, number, number];
/** 3x3 矩阵，按行展开（9 个数）。 */
type Mat3 = readonly number[];

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;
export const MOON_RADIUS_KM = 1737.4;
export const EARTH_RADIUS_KM = 6371.0;
const AU_KM = 149597870.7;
/** 太阳半径，km（IAU 2015 标称值），用来算太阳视半径。 */
const SUN_RADIUS_KM = 695700;
/** TT - UTC，秒。2017 年起有效，直到下一次闰秒。 */
const TT_MINUS_UTC_S = 69.184;

const sin = (deg: number) => Math.sin(deg * D2R);
const cos = (deg: number) => Math.cos(deg * D2R);

function mulMV(m: Mat3, v: Vec3): Vec3 {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

function mulMM(a: Mat3, b: Mat3): Mat3 {
  const out: number[] = new Array(9);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      out[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
    }
  }
  return out;
}

function normalize(v: Vec3): Vec3 {
  const len = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / len, v[1] / len, v[2] / len];
}

// IAU 约定的坐标系旋转
const rotZ = (deg: number): Mat3 => [cos(deg), sin(deg), 0, -sin(deg), cos(deg), 0, 0, 0, 1];
const rotX = (deg: number): Mat3 => [1, 0, 0, 0, cos(deg), sin(deg), 0, -sin(deg), cos(deg)];

const julianDayUtc = (ms: number) => ms / 86400000 + 2440587.5;
const julianDayTt = (ms: number) => julianDayUtc(ms) + TT_MINUS_UTC_S / 86400;

// ---- 月球：Meeus 第 47 章主要项。列：D, M, M', F, sum_l (1e-6 deg), sum_r (1e-3 km)
const LON_DIST_TERMS: readonly (readonly number[])[] = [
  [0, 0, 1, 0, 6288774, -20905355], [2, 0, -1, 0, 1274027, -3699111], [2, 0, 0, 0, 658314, -2955968], [0, 0, 2, 0, 213618, -569925],
  [0, 1, 0, 0, -185116, 48888], [0, 0, 0, 2, -114332, -3149], [2, 0, -2, 0, 58793, 246158], [2, -1, -1, 0, 57066, -152138],
  [2, 0, 1, 0, 53322, -170733], [2, -1, 0, 0, 45758, -204586], [0, 1, -1, 0, -40923, -129620], [1, 0, 0, 0, -34720, 108743],
  [0, 1, 1, 0, -30383, 104755], [2, 0, 0, -2, 15327, 10321], [0, 0, 1, 2, -12528, 0], [0, 0, 1, -2, 10980, 79661],
  [4, 0, -1, 0, 10675, -34782], [0, 0, 3, 0, 10034, -23210], [4, 0, -2, 0, 8548, -21636], [2, 1, -1, 0, -7888, 24208],
  [2, 1, 0, 0, -6766, 30824], [1, 0, -1, 0, -5163, -8379], [1, 1, 0, 0, 4987, -16675], [2, -1, 1, 0, 4036, -12831],
  [2, 0, 2, 0, 3994, -10445], [4, 0, 0, 0, 3861, -11650], [2, 0, -3, 0, 3665, 14403], [0, 1, -2, 0, -2689, -7003],
  [2, 0, -1, 2, -2602, 0], [2, -1, -2, 0, 2390, 10056], [1, 0, 1, 0, -2348, 6322], [2, -2, 0, 0, 2236, -9884],
];
// 列：D, M, M', F, sum_b (1e-6 deg)
const LAT_TERMS: readonly (readonly number[])[] = [
  [0, 0, 0, 1, 5128122], [0, 0, 1, 1, 280602], [0, 0, 1, -1, 277693], [2, 0, 0, -1, 173237], [2, 0, -1, 1, 55413], [2, 0, -1, -1, 46271],
  [2, 0, 0, 1, 32573], [0, 0, 2, 1, 17198], [2, 0, 1, -1, 9266], [0, 0, 2, -1, 8822], [2, -1, 0, -1, 8216], [2, 0, -2, -1, 4324],
  [2, 0, 1, 1, 4200], [2, 1, 0, -1, -3359], [2, -1, -1, 1, 2463], [2, -1, 0, 1, 2211], [2, -1, -1, -1, 2065], [0, 1, -1, -1, -1870],
  [4, 0, -1, -1, 1828], [0, 1, 0, 1, -1794], [0, 0, 0, 3, -1749], [0, 1, -1, 1, -1565], [1, 0, 0, 1, -1491], [0, 1, 1, 1, -1475],
  [0, 1, 1, -1, -1410], [0, 1, 0, -1, -1344], [1, 0, 0, -1, -1335], [0, 0, 3, 1, 1107],
];

/** 地心视角下月球的黄道坐标（当日黄道）：经度、纬度（度），距离（km）。 */
function moonEcliptic(jde: number) {
  const T = (jde - 2451545.0) / 36525;
  const L = 218.3164477 + 481267.88123421 * T - 0.0015786 * T * T;
  const D = 297.8501921 + 445267.1114034 * T - 0.0018819 * T * T;
  const M = 357.5291092 + 35999.0502909 * T - 0.0001536 * T * T;
  const Mp = 134.9633964 + 477198.8675055 * T + 0.0087414 * T * T;
  const F = 93.272095 + 483202.0175233 * T - 0.0036539 * T * T;
  const E = 1 - 0.002516 * T - 0.0000074 * T * T;
  const A1 = 119.75 + 131.849 * T;
  const A2 = 53.09 + 479264.29 * T;
  const A3 = 313.45 + 481266.484 * T;
  const eccentricity = (m: number) => (Math.abs(m) === 1 ? E : Math.abs(m) === 2 ? E * E : 1);

  let sumL = 0;
  let sumR = 0;
  let sumB = 0;
  for (const [d, m, mp, f, l, r] of LON_DIST_TERMS) {
    const arg = d * D + m * M + mp * Mp + f * F;
    sumL += l * eccentricity(m) * sin(arg);
    sumR += r * eccentricity(m) * cos(arg);
  }
  for (const [d, m, mp, f, b] of LAT_TERMS) {
    sumB += b * eccentricity(m) * sin(d * D + m * M + mp * Mp + f * F);
  }
  sumL += 3958 * sin(A1) + 1962 * sin(L - F) + 318 * sin(A2);
  sumB += -2235 * sin(L) + 382 * sin(A3) + 175 * sin(A1 - F) + 175 * sin(A1 + F) + 127 * sin(L - Mp) - 115 * sin(L + Mp);
  return {
    lonDeg: (((L + sumL / 1e6) % 360) + 360) % 360,
    latDeg: sumB / 1e6,
    distKm: 385000.56 + sumR / 1000,
  };
}

/** 地心视角下太阳的黄道坐标（当日黄道）：经度（度）、距离（km）。 */
function sunEcliptic(jde: number) {
  const T = (jde - 2451545.0) / 36525;
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
  const e = 0.016708634 - 0.000042037 * T;
  const C = (1.914602 - 0.004817 * T) * sin(M) + 0.019993 * sin(2 * M) + 0.000289 * sin(3 * M);
  const trueAnomaly = M + C;
  const R = (1.000001018 * (1 - e * e)) / (1 + e * cos(trueAnomaly));
  return { lonDeg: (((L0 + C) % 360) + 360) % 360, distKm: R * AU_KM };
}

/** 当日黄道坐标 -> J2000 赤道系向量：先把经度岁差回 J2000，再按 J2000 黄赤交角旋转。 */
function eclipticToEqj(lonDeg: number, latDeg: number, distKm: number, jde: number): Vec3 {
  const T = (jde - 2451545.0) / 36525;
  const lon = lonDeg - (1.396971 * T + 0.0003086 * T * T);
  const obliquity = 23.4392911;
  const x = cos(latDeg) * cos(lon);
  const y = cos(latDeg) * sin(lon);
  const z = sin(latDeg);
  return [distKm * x, distKm * (y * cos(obliquity) - z * sin(obliquity)), distKm * (y * sin(obliquity) + z * cos(obliquity))];
}

/** IAU 月球姿态：EQJ -> 月固系 的旋转矩阵。 */
function lunarOrientation(jde: number): Mat3 {
  const d = jde - 2451545.0;
  const T = d / 36525;
  const E1 = 125.045 - 0.0529921 * d;
  const E2 = 250.089 - 0.1059842 * d;
  const E3 = 260.008 + 13.0120009 * d;
  const E4 = 176.625 + 13.3407154 * d;
  const E5 = 357.529 + 0.9856003 * d;
  const E6 = 311.589 + 26.4057084 * d;
  const E7 = 134.963 + 13.064993 * d;
  const E8 = 276.617 + 0.3287146 * d;
  const E9 = 34.226 + 1.7484877 * d;
  const E10 = 15.134 - 0.1589763 * d;
  const E11 = 119.743 + 0.0036096 * d;
  const E12 = 239.961 + 0.1643573 * d;
  const E13 = 25.053 + 12.9590088 * d;
  const ra = 269.9949 + 0.0031 * T - 3.8787 * sin(E1) - 0.1204 * sin(E2) + 0.07 * sin(E3) - 0.0172 * sin(E4) + 0.0072 * sin(E6) - 0.0052 * sin(E10) + 0.0043 * sin(E13);
  const dec = 66.5392 + 0.013 * T + 1.5419 * cos(E1) + 0.0239 * cos(E2) - 0.0278 * cos(E3) + 0.0068 * cos(E4) - 0.0029 * cos(E6) + 0.0009 * cos(E7) + 0.0008 * cos(E10) - 0.0009 * cos(E13);
  const W =
    38.3213 + 13.17635815 * d - 1.4e-12 * d * d + 3.561 * sin(E1) + 0.1208 * sin(E2) - 0.0642 * sin(E3) + 0.0158 * sin(E4) + 0.0252 * sin(E5) - 0.0066 * sin(E6) -
    0.0047 * sin(E7) - 0.0046 * sin(E8) + 0.0028 * sin(E9) + 0.0052 * sin(E10) + 0.004 * sin(E11) + 0.0019 * sin(E12) - 0.0044 * sin(E13);
  return mulMM(rotZ(W), mulMM(rotX(90 - dec), rotZ(ra + 90)));
}

export interface BodyAzEl {
  /** 罗盘方位，度：正北 0，向东增加。 */
  azimuthDeg: number;
  /** 相对球面地平线的高度角，度。 */
  elevationDeg: number;
}

export interface SkyAtPoint {
  sun: BodyAzEl & {
    distanceKm: number;
    angularRadiusDeg: number;
  };
  earth: BodyAzEl & {
    distanceKm: number;
    angularRadiusDeg: number;
    illuminatedFraction: number;
  };
}

/**
 * 给定 UTC 时间（毫秒）和月面位置（月面经纬度，东经为正），返回太阳和地球的方位角、高度角。
 * 参考面是光滑球面（半径 1737.4 km）的水平线，不含地形遮挡。
 */
export function skyAtLatLon(timeMs: number, latDeg: number, lonDeg: number): SkyAtPoint {
  const up: Vec3 = [cos(latDeg) * cos(lonDeg), cos(latDeg) * sin(lonDeg), sin(latDeg)];
  const east: Vec3 = [-sin(lonDeg), cos(lonDeg), 0];
  const north: Vec3 = [-sin(latDeg) * cos(lonDeg), -sin(latDeg) * sin(lonDeg), cos(latDeg)];
  const observer: Vec3 = [up[0] * MOON_RADIUS_KM, up[1] * MOON_RADIUS_KM, up[2] * MOON_RADIUS_KM];
  // 本地坐标：x = 东，y = 上，z = 南
  const toLocal: Mat3 = [...east, ...up, -north[0], -north[1], -north[2]];

  const jde = julianDayTt(timeMs);
  const moon = moonEcliptic(jde);
  const sun = sunEcliptic(jde);
  const moonGeo = eclipticToEqj(moon.lonDeg, moon.latDeg, moon.distKm, jde);
  const sunGeo = eclipticToEqj(sun.lonDeg, 0, sun.distKm, jde);
  const orientation = lunarOrientation(jde);

  const sunBody = mulMV(orientation, [sunGeo[0] - moonGeo[0], sunGeo[1] - moonGeo[1], sunGeo[2] - moonGeo[2]]);
  const earthBody = mulMV(orientation, [-moonGeo[0], -moonGeo[1], -moonGeo[2]]);
  const sunFromObserver: Vec3 = [sunBody[0] - observer[0], sunBody[1] - observer[1], sunBody[2] - observer[2]];
  const earthFromObserver: Vec3 = [earthBody[0] - observer[0], earthBody[1] - observer[1], earthBody[2] - observer[2]];

  const sunDir = normalize(mulMV(toLocal, sunFromObserver));
  const earthDir = normalize(mulMV(toLocal, earthFromObserver));
  const azEl = (d: Vec3): BodyAzEl => ({
    azimuthDeg: (Math.atan2(d[0], -d[2]) * R2D + 360) % 360,
    elevationDeg: Math.asin(d[1]) * R2D,
  });

  const earthDistanceKm = Math.hypot(...earthFromObserver);
  const sunDistanceKm = Math.hypot(...sunFromObserver);
  // sun · earth = -1 表示"满地球"（新月）
  const cosPhase = sunDir[0] * earthDir[0] + sunDir[1] * earthDir[1] + sunDir[2] * earthDir[2];
  return {
    sun: {
      ...azEl(sunDir),
      distanceKm: sunDistanceKm,
      angularRadiusDeg: Math.asin(SUN_RADIUS_KM / sunDistanceKm) * R2D,
    },
    earth: {
      ...azEl(earthDir),
      distanceKm: earthDistanceKm,
      angularRadiusDeg: Math.asin(EARTH_RADIUS_KM / earthDistanceKm) * R2D,
      illuminatedFraction: (1 - cosPhase) / 2,
    },
  };
}
