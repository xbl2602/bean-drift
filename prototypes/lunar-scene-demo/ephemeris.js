// Where are the Sun and the Earth in the sky of a point near the lunar south pole, at a given UTC time?
// Self-contained (no ephemeris download): truncated Meeus lunar theory + low-precision Sun, and the IAU lunar orientation
// (WGCCRE 2009, the Mean-Earth/polar-axis frame LOLA uses). Expected accuracy ~0.02 deg, checked against JPL Horizons
// (tools/check_ephemeris.mjs). Good for visualising illumination and comms windows, NOT for mission-grade planning.
//
// Frames. EQJ = J2000 equatorial. Body = lunar body-fixed (x to lon 0 / lat 0, y to 90E, z north).
// Render = the DEM image frame used by the scene: x right, y up, z down the image; the pole is the origin and
// azimuth 0 (image up) is lon 0, azimuth 90 (image right) is lon 90E, so at the south pole azimuth == east longitude and
// elevation == -latitude. Render = Cb * Body with Cb = [[0,1,0],[0,0,-1],[-1,0,0]].

const D2R = Math.PI / 180, R2D = 180 / Math.PI;
export const MOON_R = 1737.4, EARTH_R = 6371.0;
const TT_MINUS_UTC = 69.184;                                   // seconds, valid 2017 onwards until the next leap second

const sin = (d) => Math.sin(d * D2R), cos = (d) => Math.cos(d * D2R);
const mulMV = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
const mulMM = (a, b) => { const o = new Array(9); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j]; return o; };
const transpose = (m) => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
const R3 = (a) => [cos(a), sin(a), 0, -sin(a), cos(a), 0, 0, 0, 1];     // frame rotations (IAU convention)
const R1 = (a) => [1, 0, 0, 0, cos(a), sin(a), 0, -sin(a), cos(a)];
const CB = [0, 1, 0, 0, 0, -1, -1, 0, 0];

export const jdUTC = (ms) => ms / 86400000 + 2440587.5;
const jdTT = (ms) => jdUTC(ms) + TT_MINUS_UTC / 86400;

// ---- Moon: Meeus ch. 47, principal terms. columns: D, M, M', F, sum_l (1e-6 deg), sum_r (1e-3 km)
const LR = [
  [0, 0, 1, 0, 6288774, -20905355], [2, 0, -1, 0, 1274027, -3699111], [2, 0, 0, 0, 658314, -2955968], [0, 0, 2, 0, 213618, -569925],
  [0, 1, 0, 0, -185116, 48888], [0, 0, 0, 2, -114332, -3149], [2, 0, -2, 0, 58793, 246158], [2, -1, -1, 0, 57066, -152138],
  [2, 0, 1, 0, 53322, -170733], [2, -1, 0, 0, 45758, -204586], [0, 1, -1, 0, -40923, -129620], [1, 0, 0, 0, -34720, 108743],
  [0, 1, 1, 0, -30383, 104755], [2, 0, 0, -2, 15327, 10321], [0, 0, 1, 2, -12528, 0], [0, 0, 1, -2, 10980, 79661],
  [4, 0, -1, 0, 10675, -34782], [0, 0, 3, 0, 10034, -23210], [4, 0, -2, 0, 8548, -21636], [2, 1, -1, 0, -7888, 24208],
  [2, 1, 0, 0, -6766, 30824], [1, 0, -1, 0, -5163, -8379], [1, 1, 0, 0, 4987, -16675], [2, -1, 1, 0, 4036, -12831],
  [2, 0, 2, 0, 3994, -10445], [4, 0, 0, 0, 3861, -11650], [2, 0, -3, 0, 3665, 14403], [0, 1, -2, 0, -2689, -7003],
  [2, 0, -1, 2, -2602, 0], [2, -1, -2, 0, 2390, 10056], [1, 0, 1, 0, -2348, 6322], [2, -2, 0, 0, 2236, -9884],
];
// columns: D, M, M', F, sum_b (1e-6 deg)
const B = [
  [0, 0, 0, 1, 5128122], [0, 0, 1, 1, 280602], [0, 0, 1, -1, 277693], [2, 0, 0, -1, 173237], [2, 0, -1, 1, 55413], [2, 0, -1, -1, 46271],
  [2, 0, 0, 1, 32573], [0, 0, 2, 1, 17198], [2, 0, 1, -1, 9266], [0, 0, 2, -1, 8822], [2, -1, 0, -1, 8216], [2, 0, -2, -1, 4324],
  [2, 0, 1, 1, 4200], [2, 1, 0, -1, -3359], [2, -1, -1, 1, 2463], [2, -1, 0, 1, 2211], [2, -1, -1, -1, 2065], [0, 1, -1, -1, -1870],
  [4, 0, -1, -1, 1828], [0, 1, 0, 1, -1794], [0, 0, 0, 3, -1749], [0, 1, -1, 1, -1565], [1, 0, 0, 1, -1491], [0, 1, 1, 1, -1475],
  [0, 1, 1, -1, -1410], [0, 1, 0, -1, -1344], [1, 0, 0, -1, -1335], [0, 0, 3, 1, 1107],
];

// geocentric Moon: ecliptic of date (lon, lat in deg, distance km)
export function moonEcliptic(jde) {
  const T = (jde - 2451545.0) / 36525;
  const L = 218.3164477 + 481267.88123421 * T - 0.0015786 * T * T;
  const D = 297.8501921 + 445267.1114034 * T - 0.0018819 * T * T;
  const M = 357.5291092 + 35999.0502909 * T - 0.0001536 * T * T;
  const Mp = 134.9633964 + 477198.8675055 * T + 0.0087414 * T * T;
  const F = 93.2720950 + 483202.0175233 * T - 0.0036539 * T * T;
  const E = 1 - 0.002516 * T - 0.0000074 * T * T;
  const A1 = 119.75 + 131.849 * T, A2 = 53.09 + 479264.290 * T, A3 = 313.45 + 481266.484 * T;
  let sl = 0, sr = 0, sb = 0;
  for (const [d, m, mp, f, l, r] of LR) { const e = Math.abs(m) === 1 ? E : Math.abs(m) === 2 ? E * E : 1, a = d * D + m * M + mp * Mp + f * F; sl += l * e * sin(a); sr += r * e * cos(a); }
  for (const [d, m, mp, f, b] of B) { const e = Math.abs(m) === 1 ? E : Math.abs(m) === 2 ? E * E : 1; sb += b * e * sin(d * D + m * M + mp * Mp + f * F); }
  sl += 3958 * sin(A1) + 1962 * sin(L - F) + 318 * sin(A2);
  sb += -2235 * sin(L) + 382 * sin(A3) + 175 * sin(A1 - F) + 175 * sin(A1 + F) + 127 * sin(L - Mp) - 115 * sin(L + Mp);
  return { lon: ((L + sl / 1e6) % 360 + 360) % 360, lat: sb / 1e6, dist: 385000.56 + sr / 1000 };
}

// geocentric Sun: ecliptic of date (lon deg, distance km)
export function sunEcliptic(jde) {
  const T = (jde - 2451545.0) / 36525;
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T, M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
  const e = 0.016708634 - 0.000042037 * T;
  const C = (1.914602 - 0.004817 * T) * sin(M) + 0.019993 * sin(2 * M) + 0.000289 * sin(3 * M);
  const nu = M + C, R = 1.000001018 * (1 - e * e) / (1 + e * cos(nu));
  return { lon: ((L0 + C) % 360 + 360) % 360, dist: R * 149597870.7 };
}

// ecliptic of date -> EQJ unit-scaled vector (precess the longitude back to J2000, then rotate by the J2000 obliquity)
function eclToEqj(lon, lat, dist, jde) {
  const T = (jde - 2451545.0) / 36525, l = lon - (1.396971 * T + 0.0003086 * T * T), eps = 23.4392911;
  const x = cos(lat) * cos(l), y = cos(lat) * sin(l), z = sin(lat);
  return [dist * x, dist * (y * cos(eps) - z * sin(eps)), dist * (y * sin(eps) + z * cos(eps))];
}

// IAU lunar orientation: matrix EQJ -> Body, plus the pole's RA/Dec and the prime meridian angle W (deg)
export function lunarOrientation(jde) {
  const d = jde - 2451545.0, T = d / 36525;
  const E1 = 125.045 - 0.0529921 * d, E2 = 250.089 - 0.1059842 * d, E3 = 260.008 + 13.0120009 * d, E4 = 176.625 + 13.3407154 * d, E5 = 357.529 + 0.9856003 * d,
    E6 = 311.589 + 26.4057084 * d, E7 = 134.963 + 13.0649930 * d, E8 = 276.617 + 0.3287146 * d, E9 = 34.226 + 1.7484877 * d, E10 = 15.134 - 0.1589763 * d,
    E11 = 119.743 + 0.0036096 * d, E12 = 239.961 + 0.1643573 * d, E13 = 25.053 + 12.9590088 * d;
  const ra = 269.9949 + 0.0031 * T - 3.8787 * sin(E1) - 0.1204 * sin(E2) + 0.0700 * sin(E3) - 0.0172 * sin(E4) + 0.0072 * sin(E6) - 0.0052 * sin(E10) + 0.0043 * sin(E13);
  const dec = 66.5392 + 0.0130 * T + 1.5419 * cos(E1) + 0.0239 * cos(E2) - 0.0278 * cos(E3) + 0.0068 * cos(E4) - 0.0029 * cos(E6) + 0.0009 * cos(E7) + 0.0008 * cos(E10) - 0.0009 * cos(E13);
  const W = 38.3213 + 13.17635815 * d - 1.4e-12 * d * d + 3.5610 * sin(E1) + 0.1208 * sin(E2) - 0.0642 * sin(E3) + 0.0158 * sin(E4) + 0.0252 * sin(E5) - 0.0066 * sin(E6)
    - 0.0047 * sin(E7) - 0.0046 * sin(E8) + 0.0028 * sin(E9) + 0.0052 * sin(E10) + 0.0040 * sin(E11) + 0.0019 * sin(E12) - 0.0044 * sin(E13);
  return { M: mulMM(R3(W), mulMM(R1(90 - dec), R3(ra + 90))), ra, dec, W };
}

// Sun and Earth as seen from the point (X, Z) metres from the pole in the DEM image frame (default: the pole itself).
// Returns unit direction vectors in the render frame (y up) with azimuth / elevation in degrees, Earth's angular
// radius and illuminated fraction, and R: the EQJ -> render matrix (used to turn the star field with the Moon).
export function skyAt(ms, X = 0, Z = 0) {
  // observer position in the body frame (polar stereographic ~ equidistant this close to the pole)
  const rho = Math.hypot(X, Z) / 1000, th = rho / MOON_R, lam = Math.atan2(X, -Z) * R2D;
  const P = [MOON_R * Math.sin(th) * cos(lam), MOON_R * Math.sin(th) * sin(lam), -MOON_R * Math.cos(th)];
  // local frame: rotate the pole's "up" onto the observer's up (parallel transport keeps the image axes aligned)
  let Rl = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  if (th > 1e-9) {
    const n = mulMV(CB, norm(P)), k = norm([n[2], 0, -n[0]]) /* n x y */, a = Math.acos(Math.max(-1, Math.min(1, n[1])));
    const c = Math.cos(a), s = Math.sin(a), [kx, ky, kz] = k;
    Rl = [c + kx * kx * (1 - c), kx * ky * (1 - c) - kz * s, kx * kz * (1 - c) + ky * s,
      ky * kx * (1 - c) + kz * s, c + ky * ky * (1 - c), ky * kz * (1 - c) - kx * s,
      kz * kx * (1 - c) - ky * s, kz * ky * (1 - c) + kx * s, c + kz * kz * (1 - c)];
  }
  return skyFrom(ms, P, mulMM(Rl, CB));
}

// Sun and Earth as seen from a point at selenographic (lat, east lon) in degrees anywhere on the Moon.
// Render frame here is the usual local one: x = east, y = up, z = south, so azimuth is the compass bearing (0 = north, 90 = east).
export function skyAtLonLat(ms, lat, lon) {
  const b = [cos(lat) * cos(lon), cos(lat) * sin(lon), sin(lat)];
  const east = [-sin(lon), cos(lon), 0], north = [-sin(lat) * cos(lon), -sin(lat) * sin(lon), cos(lat)];
  return skyFrom(ms, b.map((c) => c * MOON_R), [...east, ...b, -north[0], -north[1], -north[2]]);
}

// shared core: observer P (km, body frame) and toRender (body axes -> the render axes of the scene)
function skyFrom(ms, P, toRender) {
  const jde = jdTT(ms);
  const mo = moonEcliptic(jde), su = sunEcliptic(jde);
  const moonG = eclToEqj(mo.lon, mo.lat, mo.dist, jde), sunG = eclToEqj(su.lon, 0, su.dist, jde);
  const ori = lunarOrientation(jde);
  const sunB = mulMV(ori.M, [sunG[0] - moonG[0], sunG[1] - moonG[1], sunG[2] - moonG[2]]);
  const earthB = mulMV(ori.M, [-moonG[0], -moonG[1], -moonG[2]]);
  const sunT = [sunB[0] - P[0], sunB[1] - P[1], sunB[2] - P[2]], earthT = [earthB[0] - P[0], earthB[1] - P[1], earthB[2] - P[2]];
  const sunD = norm(mulMV(toRender, sunT)), earthD = norm(mulMV(toRender, earthT));
  const azel = (d) => ({ dir: d, az: (Math.atan2(d[0], -d[2]) * R2D + 360) % 360, el: Math.asin(d[1]) * R2D });
  const earthDist = Math.hypot(...earthT);
  const cosPhase = sunD[0] * earthD[0] + sunD[1] * earthD[1] + sunD[2] * earthD[2];     // sun . earth: -1 = full Earth (new Moon)
  return {
    sun: azel(sunD),
    earth: { ...azel(earthD), angDeg: Math.asin(EARTH_R / earthDist) * R2D, distKm: earthDist, illum: (1 - cosPhase) / 2 },
    R: mulMM(toRender, ori.M),
    moon: { dist: mo.dist, lon: mo.lon },
  };
}

// helpers for the UI
export const subSolarLonLat = (ms) => {                       // selenographic sub-solar point (east lon, lat), for checks
  const jde = jdTT(ms), mo = moonEcliptic(jde), su = sunEcliptic(jde);
  const moonG = eclToEqj(mo.lon, mo.lat, mo.dist, jde), sunG = eclToEqj(su.lon, 0, su.dist, jde);
  const b = mulMV(lunarOrientation(jde).M, norm([sunG[0] - moonG[0], sunG[1] - moonG[1], sunG[2] - moonG[2]]));
  return { lon: Math.atan2(b[1], b[0]) * R2D, lat: Math.asin(b[2]) * R2D };
};
export const subEarthLonLat = (ms) => {                       // sub-Earth point = optical + physical libration (l, b), for checks
  const jde = jdTT(ms), mo = moonEcliptic(jde), moonG = eclToEqj(mo.lon, mo.lat, mo.dist, jde);
  const b = mulMV(lunarOrientation(jde).M, norm([-moonG[0], -moonG[1], -moonG[2]]));
  return { lon: Math.atan2(b[1], b[0]) * R2D, lat: Math.asin(b[2]) * R2D, dist: mo.dist };
};
