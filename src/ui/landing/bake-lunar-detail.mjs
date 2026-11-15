// Offline bake: two tileable lunar-terrain pictures used by the console backdrop's Moon.
//
// Run from the repository root:   node src/ui/landing/bake-lunar-detail.mjs
// Writes public/landing/lunar-detail-a.png (120 km square, ~117 m per pixel, craters 0.4-14 km)
//        public/landing/lunar-detail-b.png (480 km square, ~470 m per pixel, craters 14-110 km)
// Each pixel holds: R,G = height as a 16-bit number (the page decodes it), B = brightness
// multiplier (fresh bright ejecta, dark flooded floors, and crevice shading).
//
// The craters follow real lunar statistics rather than being scattered by eye:
//  - sizes follow a power law, N(>D) ~ D^-2 (about 0.06-0.075 craters per km^2 larger than 1 km, a
//    typical highlands density), so there are many small craters and a few big ones;
//  - depth/diameter is about 0.2 for fresh bowl craters and falls to about 0.05 as they age and fill;
//    craters wider than ~18 km are "complex": flat floors, steeper walls, and a central peak above ~22 km;
//  - each crater has a raised rim and an ejecta blanket that fades as r^-3; fresh craters have bright
//    ejecta and old ones are softened;
//  - craters are stamped from oldest to youngest, so young craters cut into old ones the way real
//    overlapping craters do.
// No outside data or tools are needed. The tiles wrap around, so they repeat without seams.

import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import path from "node:path";

const OUT = path.join(process.cwd(), "public", "landing");
mkdirSync(OUT, { recursive: true });
const N = 1024;

// ---------- tiny PNG writer ----------
const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}
function writePng(file, rgb) {
  const stride = N * 3 + 1;
  const raw = Buffer.alloc(N * stride);
  for (let y = 0; y < N; y++) {
    raw[y * stride] = 0;
    rgb.copy(raw, y * stride + 1, y * N * 3, (y + 1) * N * 3);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(N, 0);
  header.writeUInt32BE(N, 4);
  header[8] = 8;
  header[9] = 2;
  writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]));
}

// ---------- helpers ----------
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const wrap = (i) => ((i % N) + N) % N;

/** Gentle rolling ground that the craters are cut into (tileable value noise, a few octaves). */
function baseTerrain(rnd, amplitudeKm, cells) {
  const height = new Float32Array(N * N);
  for (let octave = 0; octave < 5; octave++) {
    const count = cells * 2 ** octave;
    const grid = new Float32Array(count * count).map(() => rnd() * 2 - 1);
    const amp = amplitudeKm / 2 ** (octave * 1.15);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const fx = (x / N) * count;
        const fy = (y / N) * count;
        const x0 = Math.floor(fx);
        const y0 = Math.floor(fy);
        const tx = smoothstep(0, 1, fx - x0);
        const ty = smoothstep(0, 1, fy - y0);
        const at = (gx, gy) => grid[(gy % count) * count + (gx % count)];
        const top = at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx;
        const bottom = at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx;
        height[y * N + x] += (top * (1 - ty) + bottom * ty) * amp;
      }
    }
  }
  return height;
}

/** One crater cut into the height and brightness maps. All sizes in kilometres, `mpp` = km per pixel. */
function stamp(height, shade, craterX, craterY, diameterKm, fresh, mpp) {
  const radius = diameterKm / 2 / mpp; // pixels
  const reach = Math.ceil(radius * 2.7);
  const complex = diameterKm > 18;
  const depthRatio = (0.025 + 0.18 * fresh ** 1.2) * (complex ? (1.044 * diameterKm ** -0.699) / 0.2 : 1);
  const depth = diameterKm * depthRatio;
  const rimHeight = diameterKm * (0.004 + 0.018 * fresh);
  const rimWidth = 0.35 - 0.22 * fresh;
  const wall = complex ? 3.6 : 2;
  // Ground level at the rim before this crater, so a young crater cuts into whatever is already there.
  let reference = 0;
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    reference += height[wrap(Math.round(craterY + Math.sin(a) * radius)) * N + wrap(Math.round(craterX + Math.cos(a) * radius))] / 12;
  }
  const freshBright = 0.55 * fresh ** 2.2;
  for (let dy = -reach; dy <= reach; dy++) {
    for (let dx = -reach; dx <= reach; dx++) {
      const r = Math.hypot(dx, dy) / radius;
      if (r > 2.7) continue;
      const index = wrap(Math.round(craterY) + dy) * N + wrap(Math.round(craterX) + dx);
      const rim = rimHeight * Math.exp(-(((r - 1) / rimWidth) ** 2));
      const ejecta = r > 1 ? rimHeight * 0.55 * (0.4 + 0.6 * fresh) * r ** -3 : 0;
      if (r < 1.02) {
        const bowl = -depth * (1 - Math.min(1, r) ** wall) + (complex && diameterKm > 22 ? 0.22 * depth * Math.exp(-((r / 0.13) ** 2)) : 0);
        const inside = smoothstep(1.0, 0.82, r);
        height[index] = height[index] * (1 - inside) + (reference + bowl + rim) * inside + (1 - inside) * rim;
        // Fresh crater walls and floor are bright; old large floors are filled in and darker.
        const floorDark = complex && fresh < 0.5 ? 0.2 * (0.5 - fresh) * 2 : 0;
        shade[index] = shade[index] * (1 - inside) + (1 + freshBright * 0.8 - floorDark) * inside;
      } else {
        height[index] += rim + ejecta;
        shade[index] *= 1 + freshBright * Math.exp(-(r - 1) * 1.5) * (r < 2.2 ? 1 : 0.4);
      }
    }
  }
}

function blur(src, radiusPx) {
  const tmp = new Float32Array(N * N);
  const out = new Float32Array(N * N);
  const norm = 1 / (2 * radiusPx + 1);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      let sum = 0;
      for (let k = -radiusPx; k <= radiusPx; k++) sum += src[y * N + wrap(x + k)];
      tmp[y * N + x] = sum * norm;
    }
  }
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      let sum = 0;
      for (let k = -radiusPx; k <= radiusPx; k++) sum += tmp[wrap(y + k) * N + x];
      out[y * N + x] = sum * norm;
    }
  }
  return out;
}

function bakeTile({ name, sizeKm, minKm, maxKm, perKm2, rangeKm, seed, baseKm, baseCells }) {
  const rnd = seeded(seed);
  const mpp = sizeKm / N;
  const height = baseTerrain(rnd, baseKm, baseCells);
  const shade = new Float32Array(N * N).fill(1);

  // Sample crater sizes from the power law N(>D) ~ D^-2 by inverting its cumulative curve.
  const count = Math.round(perKm2 * sizeKm * sizeKm * (minKm ** -2 - maxKm ** -2));
  const craters = [];
  for (let i = 0; i < count; i++) {
    const diameter = (minKm ** -2 - rnd() * (minKm ** -2 - maxKm ** -2)) ** -0.5;
    craters.push({ x: rnd() * N, y: rnd() * N, diameter, fresh: rnd() ** 2.3 });
  }
  craters.sort((a, b) => a.fresh - b.fresh); // oldest first
  for (const crater of craters) stamp(height, shade, crater.x, crater.y, crater.diameter, crater.fresh, mpp);

  // Crevice shading from how far each point lies below its surroundings.
  const smooth = blur(height, 7);
  const rgb = Buffer.alloc(N * N * 3);
  let low = Infinity;
  let high = -Infinity;
  for (const h of height) {
    low = Math.min(low, h);
    high = Math.max(high, h);
  }
  for (let i = 0; i < N * N; i++) {
    const cavity = Math.min(1.12, Math.max(0.6, 1 + ((height[i] - smooth[i]) / (rangeKm * 0.045)) * 0.25));
    const value = Math.min(65535, Math.max(0, Math.round((height[i] / rangeKm * 0.5 + 0.5) * 65535)));
    const multiplier = Math.min(1.75, Math.max(0.5, shade[i] * cavity));
    rgb[i * 3] = value >> 8;
    rgb[i * 3 + 1] = value & 255;
    rgb[i * 3 + 2] = Math.round(((multiplier - 0.5) / 1.25) * 255);
  }
  writePng(path.join(OUT, `${name}.png`), rgb);
  console.log(`${name}: ${count} craters, height ${low.toFixed(2)} to ${high.toFixed(2)} km (range used ±${rangeKm} km)`);
  return { height, shade, mpp };
}

const tiles = [
  { name: "lunar-detail-a", sizeKm: 120, minKm: 0.35, maxKm: 14, perKm2: 0.075, rangeKm: 3, seed: 1969, baseKm: 0.06, baseCells: 4 },
  { name: "lunar-detail-b", sizeKm: 480, minKm: 14, maxKm: 110, perKm2: 0.06, rangeKm: 9, seed: 1972, baseKm: 0.25, baseCells: 4 },
];
const baked = tiles.map(bakeTile);

// A hill-shaded preview for checking the result by eye (not used by the page).
if (process.argv.includes("--preview")) {
  baked.forEach(({ height, shade, mpp }, index) => {
    const rgb = Buffer.alloc(N * N * 3);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const dx = (height[y * N + wrap(x + 1)] - height[y * N + wrap(x - 1)]) / (2 * mpp);
        const dy = (height[wrap(y + 1) * N + x] - height[wrap(y - 1) * N + x]) / (2 * mpp);
        const light = Math.max(0, (0.38 + dx * 0.6 + dy * 0.7) / Math.sqrt(1 + dx * dx + dy * dy)) ** 0.9 * shade[y * N + x];
        const v = Math.min(255, Math.round(light * 330));
        rgb.set([v, v, v], (y * N + x) * 3);
      }
    }
    writePng(path.join(process.env.PREVIEW_DIR ?? OUT, `preview-${index}.png`), rgb);
  });
}
