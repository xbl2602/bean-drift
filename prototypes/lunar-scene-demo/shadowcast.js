// Far-field terrain shadows for ANY sun direction, so they can follow the time slider (the baked shadow.png is for one direction only).
// Sweeps lines parallel to the sun azimuth: a "shadow plane" starts at the terrain height and sinks by tan(elevation) per metre
// away from the sun, rising again whenever the terrain pokes above it. Pure function: runs in a worker (shadowWorker.js) and in Node.
//   H   Float32Array n*n heights in metres, row-major (index = row * n + col; x = col, z = row), already corrected for curvature
//   px  metres per pixel
// returns Uint8Array n*n: 255 = lit, 0 = shadow, ~3 m penumbra in height terms.

export function curvatureCorrect(dem, n, px, x0, z0, R = 1737400) {
  const out = new Float32Array(n * n);
  for (let j = 0; j < n; j++) {
    const z = z0 + j * px;
    for (let i = 0; i < n; i++) { const x = x0 + i * px; out[j * n + i] = dem[j * n + i] - (x * x + z * z) / (2 * R); }
  }
  return out;
}

export function castShadow(H, n, px, azDeg, elDeg, { step = 1, penumbra = 3 } = {}) {
  const out = new Uint8Array(n * n);
  if (elDeg < -10) return out;                                          // sun far below the horizon: everything is in shadow
  const a = azDeg * Math.PI / 180, dx = -Math.sin(a), dz = Math.cos(a);   // travel direction: away from the sun (x = col, z = row)
  const wx = -dz, wz = dx;                                              // perpendicular, to enumerate the lines
  const drop = Math.tan(elDeg * Math.PI / 180) * px * step;             // plane height lost per step
  const acc = new Uint16Array(n * n), cnt = new Uint8Array(n * n);
  const c = (n - 1) / 2, qMax = (n / 2) * (Math.abs(wx) + Math.abs(wz)) + 1, last = n - 1;
  const inv = 255 / penumbra;
  for (let q = -qMax; q <= qMax; q += step) {
    const ox = c + q * wx, oz = c + q * wz;
    // parameter range of the line inside the square [0, n-1]^2
    let t0 = -1e9, t1 = 1e9;
    if (Math.abs(dx) < 1e-12) { if (ox < 0 || ox > last) continue; } else { const u = -ox / dx, v = (last - ox) / dx; t0 = Math.max(t0, Math.min(u, v)); t1 = Math.min(t1, Math.max(u, v)); }
    if (Math.abs(dz) < 1e-12) { if (oz < 0 || oz > last) continue; } else { const u = -oz / dz, v = (last - oz) / dz; t0 = Math.max(t0, Math.min(u, v)); t1 = Math.min(t1, Math.max(u, v)); }
    if (t1 <= t0) continue;
    let plane = -1e30, first = true;
    for (let t = t0; t <= t1; t += step) {
      const x = ox + t * dx, z = oz + t * dz;
      let ix = x | 0, iz = z | 0, fx = x - ix, fz = z - iz;
      if (ix < 0) { ix = 0; fx = 0; } else if (ix >= last) { ix = last - 1; fx = 1; }
      if (iz < 0) { iz = 0; fz = 0; } else if (iz >= last) { iz = last - 1; fz = 1; }
      const o = iz * n + ix;
      const h = H[o] * (1 - fx) * (1 - fz) + H[o + 1] * fx * (1 - fz) + H[o + n] * (1 - fx) * fz + H[o + n + 1] * fx * fz;
      let lit;
      if (first) { plane = h; lit = 255; first = false; }
      else {
        const cand = plane - drop, depth = cand - h;
        lit = depth <= 0 ? 255 : depth >= penumbra ? 0 : 255 - depth * inv;
        plane = cand > h ? cand : h;
      }
      const px_ = (x + 0.5) | 0, pz_ = (z + 0.5) | 0;
      if (px_ >= 0 && px_ < n && pz_ >= 0 && pz_ < n) { const k = pz_ * n + px_; acc[k] += lit; cnt[k]++; }
    }
  }
  for (let k = 0; k < n * n; k++) if (cnt[k]) out[k] = (acc[k] / cnt[k] + 0.5) | 0;
  // holes (no sample landed in the pixel): take the mean of the filled neighbours
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i;
    if (cnt[k]) continue;
    let s = 0, m = 0;
    if (i > 0 && cnt[k - 1]) { s += out[k - 1]; m++; }
    if (i < last && cnt[k + 1]) { s += out[k + 1]; m++; }
    if (j > 0 && cnt[k - n]) { s += out[k - n]; m++; }
    if (j < last && cnt[k + n]) { s += out[k + n]; m++; }
    out[k] = m ? (s / m + 0.5) | 0 : 255;
  }
  return out;
}
