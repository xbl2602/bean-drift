// A height grid for terrain sampling: Int16/Float32 samples, a 2x2-mean mip pyramid, and Catmull-Rom (bicubic) lookups.
// Shared by the south-pole LOLA DEM (lola.js) and the Apollo 11 equatorial DTM (equator.js).
//
// Pixel (i, j) is centred at (x0 + i * px, z0 + j * px); x runs along the columns, z along the rows. Heights are data * scale metres.

// Catmull-Rom (bicubic) instead of bilinear: bilinear on coarse posts leaves a crease at every post, which renders as
// pointed tent-like peaks and sharp ridge lines; regolith relief is rounded.
const cr = (p0, p1, p2, p3, t) => p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));

export function createDemGrid({ data, nx, nz, px, x0, z0, scale = 1, minSize = 64 }) {
  const levels = [];
  const first = new Float32Array(nx * nz);
  for (let i = 0; i < first.length; i++) first[i] = data[i] * scale;
  levels.push({ nx, nz, d: first });
  for (let sx = nx, sz = nz; Math.max(sx, sz) > minSize;) {
    const mx = sx >> 1, mz = sz >> 1, nxt = new Float32Array(mx * mz), src = levels[levels.length - 1].d;
    for (let y = 0; y < mz; y++) for (let x = 0; x < mx; x++) {
      const i = (2 * y) * sx + 2 * x;
      nxt[y * mx + x] = (src[i] + src[i + 1] + src[i + sx] + src[i + sx + 1]) * 0.25;
    }
    levels.push({ nx: mx, nz: mz, d: nxt }); sx = mx; sz = mz;
  }
  // (u0, v0) are index coordinates of level 0 (pixel centres at integers); level L averages blocks of 2^L pixels
  const sampleLevel = (L, u0, v0) => {
    const s = 2 ** L, { nx: lx, nz: lz, d } = levels[L], lastX = lx - 1, lastZ = lz - 1;
    const u = Math.min(lx - 1.001, Math.max(0, (u0 - (s - 1) / 2) / s)), v = Math.min(lz - 1.001, Math.max(0, (v0 - (s - 1) / 2) / s));
    const iu = u | 0, iv = v | 0, fu = u - iu, fv = v - iv;
    const ua = iu > 0 ? iu - 1 : 0, ub = iu + 1, uc = iu + 2 > lastX ? lastX : iu + 2;
    const row = (j) => { const o = (j < 0 ? 0 : j > lastZ ? lastZ : j) * lx; return cr(d[o + ua], d[o + iu], d[o + ub], d[o + uc], fu); };
    return cr(row(iv - 1), row(iv), row(iv + 1), row(iv + 2), fv);
  };
  // spacing = size of one mesh cell; sampling a coarser mip level avoids aliasing the data far from the camera.
  // Outside the grid the nearest edge sample is returned (use `inside` to blend that into something else).
  const sample = (x, z, spacing = px) => {
    const u0 = (x - x0) / px, v0 = (z - z0) / px;
    const lv = Math.min(levels.length - 1.001, Math.max(0, Math.log2(Math.max(spacing, px) / px)));
    const L = lv | 0, t = lv - L;
    const a = sampleLevel(L, u0, v0);
    return t < 1e-3 ? a : a + (sampleLevel(L + 1, u0, v0) - a) * t;
  };
  // how far (metres) the point lies outside the grid's pixel-centre rectangle; 0 inside
  const outside = (x, z) => Math.hypot(Math.max(0, x0 - x, x - (x0 + (nx - 1) * px)), Math.max(0, z0 - z, z - (z0 + (nz - 1) * px)));
  return { levels, nx, nz, px, x0, z0, sample, outside };
}

// Terrain horizon (degrees of elevation) for every whole degree of azimuth (0 = north = -z, 90 = east = +x) seen from (X, Z) at
// eye height, including the fall-away of a sphere of radius R. sample(x, z, spacing) returns heights in the same frame as (X, Z).
export function horizonProfile(sample, X, Z, { eye, px, R = 1737400, maxDist = 14000 }) {
  const out = new Float32Array(360), h0 = sample(X, Z, px) + eye;
  for (let a = 0; a < 360; a++) {
    const sa = Math.sin(a * Math.PI / 180), ca = -Math.cos(a * Math.PI / 180);
    let best = -90;
    for (let d = 15; d < maxDist; d *= 1.025) {
      const hh = sample(X + d * sa, Z + d * ca, Math.max(px, d * 0.03));
      const ang = Math.atan2(hh - h0 - d * d / (2 * R), d) * 180 / Math.PI;
      if (ang > best) best = ang;
    }
    out[a] = best;
  }
  return out;
}
