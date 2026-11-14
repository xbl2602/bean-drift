// Shared procedural content: every engine renders exactly the same geometry and textures,
// so differences in the screenshots come from the engines' lighting / materials / post-processing only.

export const EYE = 1.6;                           // metres: eye height of a standing person
export const CFG = {
  seed: 7,
  camera: { yaw: -12, pitch: 7, fov: 42, eye: EYE, near: 0.1, far: 12000 },
  sun: { az: 105, el: 10 },                       // az: degrees from forward (-Z) toward +X
  earth: { az: -22, el: 18, dist: 3000, angRad: 3.4 },
  skyRadius: 9000,
  tile: 4.0,                                      // metres per micro-detail texture tile
  galacticNormal: [-0.38, 0.91, 0.14],
  pixelRatioCap: 1.5,
  earthTint: 0.42,                                 // albedo multiplier so earth is not clipped next to the dark ground
};

const D2R = Math.PI / 180;
export const dirFromAzEl = (az, el) => {
  const a = az * D2R, e = el * D2R;
  return [Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)];
};
export const forwardVec = (yaw, pitch) => dirFromAzEl(yaw, pitch);

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const norm3 = (v) => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---------- noise ----------
function hash2(x, y, s) { let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(s, 1442695041); h = Math.imul(h ^ (h >>> 13), 1103515245); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
function hash3(x, y, z, s) { let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177) ^ Math.imul(s, 1442695041); h = Math.imul(h ^ (h >>> 13), 1103515245); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
function vnoise(x, y, s, period = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = fade(xf), v = fade(yf);
  const w = period ? (i) => ((i % period) + period) % period : (i) => i;
  const a = hash2(w(xi), w(yi), s), b = hash2(w(xi + 1), w(yi), s), c = hash2(w(xi), w(yi + 1), s), d = hash2(w(xi + 1), w(yi + 1), s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, oct, s, period = 0, gain = 0.5) {
  let a = 0.5, f = 1, sum = 0, n = 0;
  for (let i = 0; i < oct; i++) { sum += a * vnoise(x * f, y * f, s + i * 17, period ? period * f : 0); n += a; a *= gain; f *= 2; }
  return sum / n;
}
function vnoise3(x, y, z, s) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), u = fade(x - xi), v = fade(y - yi), w = fade(z - zi);
  const l = (a, b, t) => a + (b - a) * t;
  return l(
    l(l(hash3(xi, yi, zi, s), hash3(xi + 1, yi, zi, s), u), l(hash3(xi, yi + 1, zi, s), hash3(xi + 1, yi + 1, zi, s), u), v),
    l(l(hash3(xi, yi, zi + 1, s), hash3(xi + 1, yi, zi + 1, s), u), l(hash3(xi, yi + 1, zi + 1, s), hash3(xi + 1, yi + 1, zi + 1, s), u), v), w);
}
function fbm3(x, y, z, oct, s, gain = 0.5) {
  let a = 0.5, f = 1, sum = 0, n = 0;
  for (let i = 0; i < oct; i++) { sum += a * vnoise3(x * f, y * f, z * f, s + i * 31); n += a; a *= gain; f *= 2.03; }
  return sum / n;
}

// ---------- craters & boulders ----------
function craterProfile(x, c) {
  const rim = c.rh * Math.exp(-(((x - 1) / c.w) ** 2));
  if (x < 1) { const x2 = x * x; return -c.d * (1 - x2) * (1 - 0.35 * x2) + rim; }
  const f = x > 0.7 * c.reach ? 1 - smooth(0.7 * c.reach, c.reach, x) : 1;
  return (rim + c.ej * smooth(1, 1.25, x) * Math.pow(x, -3)) * f;
}

// base(x, z, spacing) -> height in metres replaces the procedural crater + macro noise (used with real DEMs);
// maxFeatureR drops procedural craters larger than that (the DEM already contains them).
// curvature (sphere radius, m) lowers the ground by d^2 / 2R with the distance d from the camera: real terrain heights are above a sphere,
// and on the Moon that sphere falls away fast (2.4 km horizon at eye height). craterDensity scales the number of small procedural craters,
// relief the height of everything procedural that is laid over a real DEM (smooth mare wants less than the cratered polar highlands).
export function buildTerrain({ rings = 340, segs = 640, rMin = 0.35, rMax = 340, base = null, maxFeatureR = Infinity, curvature = 0, craterDensity = 1, relief = 1 } = {}) {
  const rng = mulberry32(CFG.seed);
  const R = (a, b) => a + (b - a) * rng();
  const feats = [];
  const mkCrater = (x, z, Rr, age, big = false) => {
    const dr = big ? 0.088 : R(0.13, 0.2) * (1 - 0.55 * age) * (Rr < 2.5 ? 0.6 : 1);   // small craters are more degraded (shallower)
    return { t: 0, x, z, R: Rr, age, d: Rr * dr, rh: Rr * (big ? 0.04 : 0.05) * (1 - 0.6 * age), ej: Rr * 0.012 * (1 - age), w: big ? 0.22 : 0.12 + 0.1 * age, reach: big ? 1.32 : 3.2, rad: Rr * (big ? 1.32 : 3.2) };
  };
  const big = mkCrater(34, -26, 262, 0.5, true);
  const keepClear = (x, z, r) => Math.hypot(x, z) > r + 3;
  for (let i = 0; i < 110; i++) { const Rr = R(7, 44) * (rng() < 0.4 ? 0.5 : 1); const a = R(0, 6.283), r = 330 * Math.sqrt(rng()); const x = Math.cos(a) * r, z = Math.sin(a) * r; if (keepClear(x, z, Rr * 0.9)) feats.push(mkCrater(x, z, Rr, rng())); }
  const nSmall = Math.round((base ? 2000 : 3600) * craterDensity);     // with real terrain underneath, fewer procedural craters are needed
  for (let i = 0; i < nSmall; i++) { const Rr = R(1.2, 8) * R(0.6, 1); const a = R(0, 6.283), r = 330 * Math.pow(rng(), 1.25); const x = Math.cos(a) * r, z = Math.sin(a) * r; if (keepClear(x, z, Rr)) feats.push(mkCrater(x, z, Rr, rng())); }
  for (let i = 0, nTiny = Math.round(4200 * craterDensity); i < nTiny; i++) { const Rr = R(0.28, 1.8); const a = R(0, 6.283), r = 150 * Math.pow(rng(), 1.8); const x = Math.cos(a) * r, z = Math.sin(a) * r; if (Math.hypot(x, z) > Rr + 0.8) feats.push(mkCrater(x, z, Rr, rng())); }
  for (let i = 0; i < 220; i++) {
    const s = 0.3 + 0.9 * Math.pow(rng(), 2.8), a = R(0, 6.283), r = 140 * Math.pow(rng(), 1.45), x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.hypot(x, z) < s + 2.5) continue;
    const th = R(0, 6.283);
    feats.push({ t: 1, x, z, s, a: s * R(0.28, 0.5), asp: R(0.6, 1), c: Math.cos(th), sn: Math.sin(th), rad: s * 1.05 });
  }
  const CELL = 16, HALF = 380, G = Math.ceil((HALF * 2) / CELL), grid = Array.from({ length: G * G }, () => []);
  for (const f of feats) {
    const x0 = Math.max(0, Math.floor((f.x - f.rad + HALF) / CELL)), x1 = Math.min(G - 1, Math.floor((f.x + f.rad + HALF) / CELL));
    const z0 = Math.max(0, Math.floor((f.z - f.rad + HALF) / CELL)), z1 = Math.min(G - 1, Math.floor((f.z + f.rad + HALF) / CELL));
    for (let gz = z0; gz <= z1; gz++) for (let gx = x0; gx <= x1; gx++) grid[gz * G + gx].push(f);
  }
  const bigP = { ...big };
  function heightAt(x, z, minR = 0) {
    const fine = 1 - smooth(25, 70, minR * 20);                      // minR = 0.05 * distance from the camera
    let h;
    if (base) {
      h = base(x, z, minR * 0.5) + (fbm(x / 7 + 300, z / 7 + 300, 3, 5) - 0.5) * 0.22 * fine;
    } else {
      const bx = x - big.x, bz = z - big.z, br = Math.hypot(bx, bz) || 1e-6, ca = bx / br, sa = bz / br;
      const wob = 1 + 0.07 * (fbm(ca * 1.6 + 11, sa * 1.6 + 5, 3, 61) - 0.5);
      const front = smooth(-0.2, 0.95, -0.13 * ca - 0.99 * sa);         // rim towards where the camera looks (-Z)
      const sunSide = smooth(0.2, 0.95, 0.97 * ca + 0.26 * sa);          // keep the sun-facing rim low so the floor stays lit
      bigP.rh = big.rh * clamp(0.8 + 1.5 * front + 1.1 * (fbm(ca * 2.4 + 3, sa * 2.4 + 9, 3, 67) - 0.5) - 0.5 * sunSide, 0.3, 2.7);
      h = craterProfile(br / (big.R * wob), bigP);
      h += (fbm(x / 70 + 100, z / 70 + 100, 4, 3) - 0.5) * 1.8 + (fbm(x / 7 + 300, z / 7 + 300, 3, 5) - 0.5) * 0.22 * fine;
    }
    let hp = 0;                                                       // procedural craters + boulder bumps
    const gx = Math.floor((x + HALF) / CELL), gz = Math.floor((z + HALF) / CELL);
    if (gx >= 0 && gz >= 0 && gx < G && gz < G) {
      const cell = grid[gz * G + gx];
      for (let i = 0; i < cell.length; i++) {
        const f = cell[i], dx = x - f.x, dz = z - f.z;
        if ((f.t === 0 ? f.R : f.s * 2.5) < minR || (f.t === 0 && f.R > maxFeatureR)) continue;
        if (f.t === 0) { const r = Math.hypot(dx, dz); const xr = r / f.R; if (xr < f.reach) hp += craterProfile(xr, f); }
        else { const u = (dx * f.c + dz * f.sn) / f.s, v = (-dx * f.sn + dz * f.c) / (f.s * f.asp), q = u * u + v * v; if (q < 1) { const t = 1 - q; hp += f.a * t * Math.sqrt(t); } }
      }
    }
    // Craters add up here, but on a real saturated surface new craters erase old ones. Near the camera ~6 craters overlap and
    // stack to 3-4 m pits and cone-shaped peaks, which at a 1.8 m eye height read as hills. With a real DEM underneath, cap it.
    return (base ? h + relief * 1.2 * Math.tanh(hp / 1.2) : h + hp) - (curvature ? (x * x + z * z) / (2 * curvature) : 0);
  }

  // large-scale brightness: mottling + bright ejecta of young craters (stored as vertex colours)
  function shadeAt(x, z, minR) {
    let v = 0.86 + 0.34 * (fbm(x / 55 + 500, z / 55 + 500, 4, 77) - 0.5) * 2 * 0.75;
    const gx = Math.floor((x + HALF) / CELL), gz = Math.floor((z + HALF) / CELL);
    if (gx >= 0 && gz >= 0 && gx < G && gz < G) {
      const cell = grid[gz * G + gx];
      for (let i = 0; i < cell.length; i++) {
        const f = cell[i];
        if (f.t !== 0 || f.R < Math.max(minR, 2.5) || f.R > maxFeatureR || f.age > 0.55) continue;
        const xr = Math.hypot(x - f.x, z - f.z) / f.R;
        if (xr < 3.2) v += (0.55 - f.age) * 1.5 * Math.exp(-(((xr - 1.5) / 1.1) ** 2));
      }
    }
    if (base) return v;
    const xb = Math.hypot(x - big.x, z - big.z) / big.R;
    return v * (1 - 0.12 * (1 - smooth(0.3, 0.95, xb)));
  }

  // polar mesh centred on the camera: dense near, sparse far
  const k = Math.pow(rMax / rMin, 1 / rings);
  const V = 1 + (rings + 1) * segs;
  const pos = new Float32Array(V * 3), nor = new Float32Array(V * 3), uv = new Float32Array(V * 2), tan = new Float32Array(V * 4), col = new Float32Array(V * 3);
  const put = (i, x, z) => {
    const mr = 0.05 * Math.hypot(x, z), sh = clamp(shadeAt(x, z, mr), 0.4, 1.6);
    pos[i * 3] = x; pos[i * 3 + 1] = heightAt(x, z, mr); pos[i * 3 + 2] = z;
    uv[i * 2] = x / CFG.tile; uv[i * 2 + 1] = z / CFG.tile;
    col[i * 3] = sh; col[i * 3 + 1] = sh * 0.985; col[i * 3 + 2] = sh * 0.955;
  };
  put(0, 0, 0);
  for (let i = 0; i <= rings; i++) {
    const r = rMin * Math.pow(k, i);
    for (let j = 0; j < segs; j++) { const a = (j / segs) * Math.PI * 2; put(1 + i * segs + j, Math.cos(a) * r, Math.sin(a) * r); }
  }
  // normals from the polar grid neighbours (one height evaluation per vertex)
  const at = (i, j) => 1 + Math.min(rings, Math.max(0, i)) * segs + ((j % segs) + segs) % segs;
  const setN = (v, n) => {
    nor[v * 3] = n[0]; nor[v * 3 + 1] = n[1]; nor[v * 3 + 2] = n[2];
    const d = n[0], t = norm3([1 - n[0] * d, -n[1] * d, -n[2] * d]);
    tan[v * 4] = t[0]; tan[v * 4 + 1] = t[1]; tan[v * 4 + 2] = t[2]; tan[v * 4 + 3] = -1;
  };
  setN(0, [0, 1, 0]);
  for (let i = 0; i <= rings; i++) for (let j = 0; j < segs; j++) {
    const a = at(i - 1, j), b = at(i + 1, j), c = at(i, j - 1), d = at(i, j + 1);
    const pr = [pos[b * 3] - pos[a * 3], pos[b * 3 + 1] - pos[a * 3 + 1], pos[b * 3 + 2] - pos[a * 3 + 2]];
    const pt = [pos[d * 3] - pos[c * 3], pos[d * 3 + 1] - pos[c * 3 + 1], pos[d * 3 + 2] - pos[c * 3 + 2]];
    let n = norm3(cross3(pt, pr)); if (n[1] < 0) n = [-n[0], -n[1], -n[2]];
    setN(1 + i * segs + j, n);
  }
  const idx = new Uint32Array((segs + rings * segs * 2) * 3);
  let p = 0;
  for (let j = 0; j < segs; j++) { idx[p++] = 0; idx[p++] = 1 + ((j + 1) % segs); idx[p++] = 1 + j; }
  for (let i = 0; i < rings; i++) for (let j = 0; j < segs; j++) {
    const j1 = (j + 1) % segs, A = 1 + i * segs + j, B = 1 + i * segs + j1, C = 1 + (i + 1) * segs + j, D = 1 + (i + 1) * segs + j1;
    idx[p++] = A; idx[p++] = B; idx[p++] = C; idx[p++] = B; idx[p++] = D; idx[p++] = C;
  }
  return { positions: pos, normals: nor, uvs: uv, tangents: tan, colors: col, indices: idx, heightAt };
}

// ---------- rocks (instance transforms: px,py,pz, qx,qy,qz,qw, sx,sy,sz) ----------
const qmul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
export function scatterRocks(terrain, { count, rMax, rPow, sMin, sMax, sPow, cluster = 0.3, rMin = 3.5 }, seed = 1) {
  const rng = mulberry32(CFG.seed + seed), R = (a, b) => a + (b - a) * rng(), out = new Float32Array(count * 10);
  const centers = Array.from({ length: 26 }, () => { const a = R(0, 6.283), r = rMax * Math.pow(rng(), rPow); return [Math.cos(a) * r, Math.sin(a) * r]; });
  for (let i = 0; i < count; i++) {
    let x, z;
    for (let tries = 0; tries < 20; tries++) {
      if (rng() < cluster) { const c = centers[(rng() * centers.length) | 0], a = R(0, 6.283), r = Math.abs(rng() + rng() + rng() - 1.5) * (4 + rMax * 0.05); x = c[0] + Math.cos(a) * r; z = c[1] + Math.sin(a) * r; }
      else { const a = R(0, 6.283), r = rMax * Math.pow(rng(), rPow); x = Math.cos(a) * r; z = Math.sin(a) * r; }
      if (Math.hypot(x, z) > rMin) break;
    }
    const s = sMin + (sMax - sMin) * Math.pow(rng(), sPow), sx = s * R(0.8, 1.35), sy = s * R(0.45, 0.9), sz = s * R(0.8, 1.35);
    const yaw = R(0, 6.283), tilt = R(0, 0.35), ax = R(0, 6.283);
    const q = qmul([0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)], [Math.sin(tilt / 2) * Math.cos(ax), 0, Math.sin(tilt / 2) * Math.sin(ax), Math.cos(tilt / 2)]);
    const o = i * 10;
    out[o] = x; out[o + 1] = terrain.heightAt(x, z) + sy * 0.1; out[o + 2] = z;
    out[o + 3] = q[0]; out[o + 4] = q[1]; out[o + 5] = q[2]; out[o + 6] = q[3];
    out[o + 7] = sx; out[o + 8] = sy; out[o + 9] = sz;
  }
  return out;
}
export { fbm3, fbm };

// ---------- micro-detail textures (tileable) ----------
export function buildMicroTextures(N = 1024) {
  const P = 8;                                   // lattice period for tiling noise
  const H = new Float32Array(N * N);
  const rng = mulberry32(CFG.seed + 99);
  const texel = CFG.tile / N;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N * P, v = y / N * P;
    H[y * N + x] = (fbm(u, v, 7, 11, P, 0.56) - 0.5) * 0.075 + (fbm(u * 6, v * 6, 4, 23, P * 6, 0.5) - 0.5) * 0.012;
  }
  const stamp = (cx, cy, rp, c) => {
    const r0 = Math.ceil(rp * c.reach);
    for (let dy = -r0; dy <= r0; dy++) for (let dx = -r0; dx <= r0; dx++) {
      const r = Math.hypot(dx, dy) / rp; if (r >= c.reach) continue;
      const xx = (((cx + dx) % N) + N) % N, yy = (((cy + dy) % N) + N) % N;
      H[yy * N + xx] += craterProfile(r, c);
    }
  };
  for (let i = 0; i < 260; i++) {
    const rp = 5 + 42 * Math.pow(rng(), 2.0), Rm = rp * texel, age = rng();
    stamp((rng() * N) | 0, (rng() * N) | 0, rp, { d: Rm * 0.16 * (1 - 0.5 * age), rh: Rm * 0.06 * (1 - 0.6 * age), ej: Rm * 0.012, w: 0.12 + 0.1 * age, reach: 2.6 });
  }
  for (let i = 0; i < 2600; i++) {   // pebbles
    const cx = (rng() * N) | 0, cy = (rng() * N) | 0, rp = 2 + rng() * 7, a = rp * texel * (0.5 + rng() * 0.6);
    for (let dy = -9; dy <= 9; dy++) for (let dx = -9; dx <= 9; dx++) { const q = (dx * dx + dy * dy) / (rp * rp); if (q < 1) { const t = 1 - q; H[((((cy + dy) % N) + N) % N) * N + ((((cx + dx) % N) + N) % N)] += a * t * Math.sqrt(t); } }
  }
  const nrm = document.createElement('canvas'), alb = document.createElement('canvas');
  nrm.width = nrm.height = alb.width = alb.height = N;
  const nd = nrm.getContext('2d').createImageData(N, N), ad = alb.getContext('2d').createImageData(N, N);
  const h = (x, y) => H[(((y % N) + N) % N) * N + (((x % N) + N) % N)];
  const STR = 1.5;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const gx = (h(x + 1, y) - h(x - 1, y)) / (2 * texel) * STR, gy = (h(x, y + 1) - h(x, y - 1)) / (2 * texel) * STR;
    const n = norm3([-gx, gy, 1]);                      // canvas rows go down => +v is up: ny = +dH/drow
    const i = (y * N + x) * 4;
    nd.data[i] = (n[0] * 0.5 + 0.5) * 255; nd.data[i + 1] = (n[1] * 0.5 + 0.5) * 255; nd.data[i + 2] = (n[2] * 0.5 + 0.5) * 255; nd.data[i + 3] = 255;
    const lap = h(x - 1, y) + h(x + 1, y) + h(x, y - 1) + h(x, y + 1) - 4 * h(x, y);
    const cav = clamp(1 - lap / texel * 0.9, 0.55, 1.25);
    const vari = 0.93 + 0.14 * fbm(x / N * P * 3, y / N * P * 3, 5, 41, P * 3) + (hash2(x, y, 5) - 0.5) * 0.12;
    const g = clamp(0.27 * vari * cav, 0, 1);
    ad.data[i] = clamp(g * 1.02, 0, 1) * 255; ad.data[i + 1] = clamp(g * 0.99, 0, 1) * 255; ad.data[i + 2] = clamp(g * 0.95, 0, 1) * 255; ad.data[i + 3] = 255;
  }
  nrm.getContext('2d').putImageData(nd, 0, 0); alb.getContext('2d').putImageData(ad, 0, 0);
  return { normal: nrm, albedo: alb };
}

// ---------- sky ----------
export function buildStarfield(W = 8192, Hh = 4096) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = Hh;
  const ctx = cv.getContext('2d'); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, Hh);
  const gN = norm3(CFG.galacticNormal), gU = norm3(cross3(gN, [0, 0, 1])), gV = cross3(gN, gU);
  const dirAt = (px, py, w, h) => { const ph = px / w * Math.PI * 2, th = py / h * Math.PI; return [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)]; };
  // milky way, low-res then upscaled
  const mw = document.createElement('canvas'); mw.width = 1024; mw.height = 512;
  const md = mw.getContext('2d').createImageData(1024, 512);
  for (let y = 0; y < 512; y++) for (let x = 0; x < 1024; x++) {
    const d = dirAt(x + 0.5, y + 0.5, 1024, 512), b = Math.asin(clamp(dot3(d, gN), -1, 1)), l = Math.atan2(dot3(d, gV), dot3(d, gU));
    const cloud = fbm3(d[0] * 3.2, d[1] * 3.2, d[2] * 3.2, 6, 71);
    let I = Math.exp(-((b / 0.17) ** 2)) * (0.45 + 1.1 * cloud) + 0.35 * Math.exp(-((b / 0.4) ** 2)) * cloud;
    I *= 1 + 1.7 * Math.exp(-((l / 0.9) ** 2));
    const dust = 0.7 * smooth(0.5, 0.78, fbm3(d[0] * 6.5 + 4, d[1] * 6.5, d[2] * 6.5 - 3, 5, 91)) * Math.exp(-((b / 0.1) ** 2));
    I *= 1 - 0.85 * dust;
    const warm = clamp(Math.exp(-((l / 1.1) ** 2)), 0, 1), i = (y * 1024 + x) * 4;
    I = clamp(I * 0.2, 0, 1);
    md.data[i] = 255 * I * (0.72 + 0.28 * warm); md.data[i + 1] = 255 * I * (0.8 + 0.1 * warm); md.data[i + 2] = 255 * I * (1 - 0.28 * warm); md.data[i + 3] = 255;
  }
  mw.getContext('2d').putImageData(md, 0, 0);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(mw, 0, 0, W, Hh);
  // stars
  const rng = mulberry32(CFG.seed + 5);
  ctx.globalCompositeOperation = 'lighter';
  const cols = [[0.82, 0.88, 1], [0.92, 0.95, 1], [1, 1, 1], [1, 0.97, 0.92], [1, 0.9, 0.76], [1, 0.84, 0.68]];
  const star = (px, py, br, sz, col) => {
    const c = `${col[0] * 255 | 0},${col[1] * 255 | 0},${col[2] * 255 | 0}`;
    if (sz < 1.1) { ctx.fillStyle = `rgba(${c},${br})`; ctx.fillRect(px, py, 1, 1); return; }
    const g = ctx.createRadialGradient(px, py, 0, px, py, sz * 1.8);
    g.addColorStop(0, `rgba(${c},${Math.min(1, br)})`); g.addColorStop(0.28, `rgba(${c},${br * 0.45})`); g.addColorStop(1, `rgba(${c},0)`);
    ctx.fillStyle = g; ctx.fillRect(px - sz * 1.8, py - sz * 1.8, sz * 3.6, sz * 3.6);
  };
  let made = 0;
  while (made < 30000) {
    const px = rng() * W, py = rng() * Hh, d = dirAt(px, py, W, Hh), b = Math.asin(clamp(dot3(d, gN), -1, 1));
    if (rng() > 0.3 + 0.9 * Math.exp(-((b / 0.3) ** 2))) continue;
    if (Math.abs(py / Hh - 0.5) > 0.495) continue;
    made++;
    const m = Math.pow(rng(), 7);                 // most stars faint
    const sz = m > 0.5 ? 1.2 + 1.6 * m : m > 0.12 ? 1.15 : 1;
    star(px, py, 0.18 + 0.82 * Math.pow(m, 0.5), sz, cols[(rng() * cols.length) | 0]);
  }
  for (let i = 0; i < 45; i++) { const px = rng() * W, py = (0.12 + 0.76 * rng()) * Hh; star(px, py, 1, 2.0 + rng() * 1.6, cols[(rng() * cols.length) | 0]); }
  ctx.globalCompositeOperation = 'source-over';
  return cv;
}

// ---------- earth ----------
function srgb(c) { return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; }
export function buildEarthTextures(W = 2048, Hh = 1024) {
  const alb = document.createElement('canvas'), cld = document.createElement('canvas'), lit = document.createElement('canvas');
  alb.width = lit.width = W; alb.height = lit.height = Hh; cld.width = W / 2; cld.height = Hh / 2;
  const ad = alb.getContext('2d').createImageData(W, Hh), ld = lit.getContext('2d').createImageData(W, Hh);
  for (let y = 0; y < Hh; y++) {
    const th = (y + 0.5) / Hh * Math.PI, lat = Math.PI / 2 - th;
    for (let x = 0; x < W; x++) {
      const ph = (x + 0.5) / W * Math.PI * 2, p = [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)];
      const wx = fbm3(p[0] * 1.5 + 7, p[1] * 1.5, p[2] * 1.5, 3, 131) - 0.5, wy = fbm3(p[0] * 1.5, p[1] * 1.5 + 9, p[2] * 1.5, 3, 133) - 0.5, wz = fbm3(p[0] * 1.5, p[1] * 1.5, p[2] * 1.5 + 5, 3, 137) - 0.5;
      const L = fbm3(p[0] * 1.35 + wx * 1.3, p[1] * 1.35 + wy * 1.3, p[2] * 1.35 + wz * 1.3, 6, 141, 0.52);
      const e = L - 0.485, i = (y * W + x) * 4, al = Math.abs(lat) / (Math.PI / 2);
      let r, g, b;
      if (e < 0) { const dp = clamp(-e / 0.14, 0, 1); r = 0.012 + 0.02 * (1 - dp); g = 0.06 + 0.12 * (1 - dp) ** 1.4; b = 0.16 + 0.26 * (1 - dp) ** 1.1; }
      else {
        const hgt = clamp(e / 0.2, 0, 1), dry = smooth(0.18, 0.55, 1 - Math.abs(al - 0.34) * 2.4 + (fbm3(p[0] * 4, p[1] * 4, p[2] * 4, 4, 151) - 0.5) * 0.9);
        const gr = [0.07, 0.17, 0.045], de = [0.38, 0.28, 0.14], mt = [0.26, 0.22, 0.18];
        r = gr[0] + (de[0] - gr[0]) * dry; g = gr[1] + (de[1] - gr[1]) * dry; b = gr[2] + (de[2] - gr[2]) * dry;
        const m = smooth(0.4, 0.95, hgt); r += (mt[0] - r) * m; g += (mt[1] - g) * m; b += (mt[2] - b) * m;
        const v = 0.8 + 0.4 * fbm3(p[0] * 9, p[1] * 9, p[2] * 9, 4, 161); r *= v; g *= v; b *= v;
      }
      const ice = smooth(0.82, 0.9, al + (fbm3(p[0] * 5, p[1] * 5, p[2] * 5, 4, 171) - 0.5) * 0.12);
      r += (0.85 - r) * ice; g += (0.88 - g) * ice; b += (0.92 - b) * ice;
      ad.data[i] = srgb(clamp(r, 0, 1)) * 255; ad.data[i + 1] = srgb(clamp(g, 0, 1)) * 255; ad.data[i + 2] = srgb(clamp(b, 0, 1)) * 255; ad.data[i + 3] = 255;
      let Lc = 0;                                                            // city lights: land, away from the poles, clustered towards coasts
      if (e > 0.004 && al < 0.72 && ice < 0.2) { const c = fbm3(p[0] * 16, p[1] * 16, p[2] * 16, 4, 191), coast = 1 - smooth(0.03, 0.16, e); Lc = smooth(0.57, 0.72, c) * (0.25 + 0.75 * coast); }
      ld.data[i] = 255 * Lc; ld.data[i + 1] = 255 * Lc * 0.72; ld.data[i + 2] = 255 * Lc * 0.4; ld.data[i + 3] = 255;
    }
  }
  alb.getContext('2d').putImageData(ad, 0, 0); lit.getContext('2d').putImageData(ld, 0, 0);
  const cw = W / 2, ch = Hh / 2, cd = cld.getContext('2d').createImageData(cw, ch);
  const cga = document.createElement('canvas'); cga.width = cw; cga.height = ch;
  const gd = cga.getContext('2d').createImageData(cw, ch);              // opaque grayscale copy: avoids premultiplied-alpha colour fringes
  for (let y = 0; y < ch; y++) {
    const th = (y + 0.5) / ch * Math.PI, lat = Math.PI / 2 - th;
    for (let x = 0; x < cw; x++) {
      const ph = (x + 0.5) / cw * Math.PI * 2, p = [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)];
      const band = 0.5 + 0.5 * Math.cos(lat * 6.0 + 1.2);
      const q = fbm3(p[0] * 2.2, p[1] * 5.0, p[2] * 2.2, 3, 181) - 0.5;
      const c = fbm3(p[0] * 3 + q * 1.4, p[1] * 3.6 + q, p[2] * 3 + q * 1.4, 6, 183, 0.55);
      const a = smooth(0.54 + 0.08 * (1 - band), 0.8, c) * 0.9, i = (y * cw + x) * 4;
      cd.data[i] = cd.data[i + 1] = cd.data[i + 2] = 255; cd.data[i + 3] = a * 255;
      gd.data[i] = gd.data[i + 1] = gd.data[i + 2] = a * 255; gd.data[i + 3] = 255;
    }
  }
  cld.getContext('2d').putImageData(cd, 0, 0); cga.getContext('2d').putImageData(gd, 0, 0);
  return { albedo: alb, clouds: cld, cloudAlpha: cga, lights: lit };
}

// ---------- geometry helpers ----------
export function earthPlacement() {
  const e = dirFromAzEl(CFG.earth.az, CFG.earth.el), D = CFG.earth.dist, Re = D * Math.sin(CFG.earth.angRad * D2R);
  return { dir: e, center: e.map((c) => c * D), radius: Re };
}

export function buildSphere({ radius, lonSeg = 192, latSeg = 96, inside = false, center = [0, 0, 0], tilt = 23.4, spin = 0 }) {
  const V = (lonSeg + 1) * (latSeg + 1), pos = new Float32Array(V * 3), nor = new Float32Array(V * 3), uv = new Float32Array(V * 2);
  const idx = new Uint32Array(lonSeg * latSeg * 6);
  const cz = Math.cos(tilt * D2R), sz = Math.sin(tilt * D2R), cy = Math.cos(spin * D2R), sy = Math.sin(spin * D2R);
  let k = 0;
  for (let j = 0; j <= latSeg; j++) for (let i = 0; i <= lonSeg; i++, k++) {
    const th = j / latSeg * Math.PI, ph = i / lonSeg * Math.PI * 2;
    let n = [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)];
    n = [n[0] * cy + n[2] * sy, n[1], -n[0] * sy + n[2] * cy];          // spin around Y
    n = [n[0] * cz - n[1] * sz, n[0] * sz + n[1] * cz, n[2]];           // axial tilt around Z
    pos[k * 3] = center[0] + n[0] * radius; pos[k * 3 + 1] = center[1] + n[1] * radius; pos[k * 3 + 2] = center[2] + n[2] * radius;
    const s = inside ? -1 : 1; nor[k * 3] = n[0] * s; nor[k * 3 + 1] = n[1] * s; nor[k * 3 + 2] = n[2] * s;
    uv[k * 2] = i / lonSeg; uv[k * 2 + 1] = 1 - j / latSeg;
  }
  let p = 0;
  for (let j = 0; j < latSeg; j++) for (let i = 0; i < lonSeg; i++) {
    const a = j * (lonSeg + 1) + i, b = a + 1, c = a + lonSeg + 1, d = c + 1;
    if (inside) { idx[p++] = a; idx[p++] = c; idx[p++] = b; idx[p++] = b; idx[p++] = c; idx[p++] = d; }
    else { idx[p++] = a; idx[p++] = b; idx[p++] = c; idx[p++] = b; idx[p++] = d; idx[p++] = c; }
  }
  return { positions: pos, normals: nor, uvs: uv, indices: idx };
}

// camera-facing quad behind the earth that carries the atmosphere glow
export function buildEarthGlow(N = 512) {
  const { dir: e, center, radius: Re } = earthPlacement(), sun = dirFromAzEl(CFG.sun.az, CFG.sun.el);
  const n = e.map((c) => -c), r = norm3(cross3([0, 1, 0], n)), u = cross3(n, r);
  const ext = 1.6, back = 1.25 * Re, scale = (CFG.earth.dist + back) / CFG.earth.dist;
  const c0 = center.map((c, i) => c + e[i] * back), half = ext * Re * scale;
  const corners = [[-1, 1], [1, 1], [1, -1], [-1, -1]].map(([a, b]) => c0.map((c, i) => c + (r[i] * a + u[i] * b) * half));
  const mesh = { positions: new Float32Array(corners.flat()), normals: new Float32Array([...n, ...n, ...n, ...n]), uvs: new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]), indices: new Uint32Array([0, 3, 1, 1, 3, 2]) };
  const sp = [dot3(sun, r), dot3(sun, u)], sl = Math.hypot(sp[0], sp[1]) || 1;
  const cv = document.createElement('canvas'); cv.width = cv.height = N;
  const id = cv.getContext('2d').createImageData(N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const qx = ((x + 0.5) / N - 0.5) * 2 * ext, qy = -((y + 0.5) / N - 0.5) * 2 * ext, rho = Math.hypot(qx, qy), i = (y * N + x) * 4;
    let g = 0;
    if (rho > 0.985) {
      const cs = (qx * sp[0] + qy * sp[1]) / (rho * sl), side = Math.pow(clamp(0.5 + 0.5 * cs, 0, 1), 1.6);
      const sunlit = 0.12 + 0.88 * side;
      g = (Math.exp(-(rho - 1) / 0.022) * 0.95 + Math.exp(-(rho - 1) / 0.11) * 0.26 + Math.exp(-(rho - 1) / 0.35) * 0.05) * sunlit * (1 - smooth(1.45, 1.6, rho));
    }
    id.data[i] = srgb(clamp(g * 0.42, 0, 1)) * 255; id.data[i + 1] = srgb(clamp(g * 0.66, 0, 1)) * 255; id.data[i + 2] = srgb(clamp(g * 1.0, 0, 1)) * 255; id.data[i + 3] = 255;
  }
  cv.getContext('2d').putImageData(id, 0, 0);
  return { mesh, texture: cv };
}

// ---------- scene description shared by all engines ----------
export async function buildAll(status = () => {}, opts = {}) {
  const tick = () => new Promise((r) => setTimeout(r, 16));
  status('terrain mesh…'); await tick();
  const terrain = buildTerrain(opts.terrain || {});
  status('micro-detail textures…'); await tick();
  const micro = buildMicroTextures();
  status('starfield + milky way…'); await tick();
  const stars = buildStarfield();
  status('earth…'); await tick();
  const earthTex = buildEarthTextures();
  const place = earthPlacement();
  const earth = buildSphere({ radius: place.radius, center: place.center, spin: 200 });
  const clouds = buildSphere({ radius: place.radius * 1.012, center: place.center, spin: 200 });
  const sky = buildSphere({ radius: CFG.skyRadius, lonSeg: 96, latSeg: 48, inside: true });
  const glow = buildEarthGlow();
  status('rocks...'); await tick();
  const rocks = scatterRocks(terrain, { count: opts.rocks ?? 620, rMax: 170, rPow: 1.5, sMin: 0.2, sMax: 0.9, sPow: 4.2, cluster: 0.6, rMin: 8 }, 1);
  const pebbles = scatterRocks(terrain, { count: opts.pebbles ?? 1100, rMax: 30, rPow: 1.2, sMin: 0.04, sMax: 0.18, sPow: 2.8, cluster: 0.45, rMin: 3 }, 2);
  const eye = [0, terrain.heightAt(0, 0) + CFG.camera.eye, 0];
  return { terrain, micro, stars, earthTex, earth, clouds, sky, glow, eye, rocks, pebbles, sunDir: dirFromAzEl(CFG.sun.az, CFG.sun.el), earthDir: place.dir };
}

// ---------- tiny UI helpers ----------
export function pixelRatio() { return Math.min(window.devicePixelRatio || 1, CFG.pixelRatioCap); }

export function makeHud(label) {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;left:14px;top:12px;font:12px/1.5 ui-monospace,Menlo,Consolas,monospace;color:#cfd8e6;background:rgba(5,8,14,.55);padding:6px 10px;border-radius:6px;pointer-events:none;z-index:5;white-space:pre';
  document.body.appendChild(el);
  const shot = new URLSearchParams(location.search).has('shot');
  if (shot) el.style.display = 'none';
  let frames = 0, last = performance.now(), fps = 0, status = 'loading…';
  return {
    setLabel(l) { label = l; },
    set(s) { status = s; el.textContent = `${label}\n${status}`; },
    frame() { frames++; const t = performance.now(); if (t - last > 500) { fps = frames * 1000 / (t - last); frames = 0; last = t; el.textContent = `${label}\n${fps.toFixed(0)} fps · drag = look · wheel = zoom`; window.__fps = fps; } },
  };
}

export function attachLook(el, state, onChange) {
  let drag = null;
  el.addEventListener('pointerdown', (e) => { drag = [e.clientX, e.clientY]; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointerup', () => { drag = null; });
  el.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const k = 0.12 * state.fov / 40;
    state.yaw += (e.clientX - drag[0]) * k * -1; state.pitch = clamp(state.pitch + (e.clientY - drag[1]) * k, -12, 85);
    drag = [e.clientX, e.clientY]; onChange(state);
  });
  el.addEventListener('wheel', (e) => { e.preventDefault(); state.fov = clamp(state.fov * Math.exp(e.deltaY * 0.001), 18, 65); onChange(state); }, { passive: false });
}
