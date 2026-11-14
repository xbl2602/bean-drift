// Prepares the ground for the hero's "standing on the Moon" view.
//
// Large shapes (mountains, crater rims) are REAL: NASA LOLA elevation of the lunar south pole,
// the team's 640 x 640 crop at 65.6 m per sample (see docs/CREDITS.md).
// That data cannot show anything smaller than a football pitch, so the ground near your feet
// (small craters, rocks, ripples) is generated here by code. It is decoration, not data.

export type SurfaceTerrain = {
  /** Smoothed LOLA heights in metres, relative to the ground under the camera. Row 0 is north. */
  base: Float32Array;
  baseSize: number;
  /** World x / z of the base map's north-west corner, and its side length, in metres. */
  baseCornerXM: number;
  baseCornerZM: number;
  baseSideM: number;
  /** Repeating square tiles of generated detail, heights in metres. */
  mid: Float32Array;
  fine: Float32Array;
  detailSize: number;
  /** Highest base height (relative, metres); rays climbing above this can stop early. */
  maxHeightM: number;
};

// From prototypes/landing-page-v2/assets/terrain-meta.json.
const SOURCE_SIZE = 640;
const SOURCE_SPACING_M = 65.625;
const SOURCE_FIRST_SAMPLE_M = -20977.1875; // world x and z of sample (0, 0)
const UPSAMPLE = 3;
const DETAIL_SIZE = 1024;

export const MID_TILE_M = 2600;
export const FINE_TILE_M = 80;

/** Small repeatable random generator, so every visitor gets the same ground. */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth curve through four evenly spaced samples (Catmull-Rom), evaluated between the middle two. */
function cubic(a: number, b: number, c: number, d: number, t: number): number {
  return b + 0.5 * t * (c - a + t * (2 * a - 5 * b + 4 * c - d + t * (3 * (b - c) + d - a)));
}

/** Enlarges the 640 grid three times with smooth curves, so slopes do not show 65 m facets. */
function upsampleSmooth(source: Int16Array): Float32Array {
  const n = SOURCE_SIZE;
  const m = n * UPSAMPLE;
  const clampIndex = (i: number) => Math.min(n - 1, Math.max(0, i));
  const wide = new Float32Array(m * n); // stretched along x only
  for (let row = 0; row < n; row++) {
    for (let x = 0; x < m; x++) {
      const pos = (x + 0.5) / UPSAMPLE - 0.5;
      const i = Math.floor(pos);
      const o = row * n;
      wide[row * m + x] = cubic(
        source[o + clampIndex(i - 1)],
        source[o + clampIndex(i)],
        source[o + clampIndex(i + 1)],
        source[o + clampIndex(i + 2)],
        pos - i,
      );
    }
  }
  const out = new Float32Array(m * m);
  for (let y = 0; y < m; y++) {
    const pos = (y + 0.5) / UPSAMPLE - 0.5;
    const j = Math.floor(pos);
    const t = pos - j;
    const r0 = clampIndex(j - 1) * m;
    const r1 = clampIndex(j) * m;
    const r2 = clampIndex(j + 1) * m;
    const r3 = clampIndex(j + 2) * m;
    for (let x = 0; x < m; x++) {
      out[y * m + x] = cubic(wide[r0 + x], wide[r1 + x], wide[r2 + x], wide[r3 + x], t);
    }
  }
  return out;
}

/** Adds one layer of smooth random bumps that repeats seamlessly at the tile edges. */
function addTileableNoise(tile: Float32Array, cells: number, amplitudeM: number, random: () => number): void {
  const size = DETAIL_SIZE;
  const lattice = new Float32Array(cells * cells);
  for (let i = 0; i < lattice.length; i++) lattice[i] = random() * 2 - 1;
  for (let y = 0; y < size; y++) {
    const gy = (y / size) * cells;
    const y0 = Math.floor(gy);
    const fy = gy - y0;
    const sy = fy * fy * (3 - 2 * fy);
    const rowA = (y0 % cells) * cells;
    const rowB = ((y0 + 1) % cells) * cells;
    for (let x = 0; x < size; x++) {
      const gx = (x / size) * cells;
      const x0 = Math.floor(gx);
      const fx = gx - x0;
      const sx = fx * fx * (3 - 2 * fx);
      const colA = x0 % cells;
      const colB = (x0 + 1) % cells;
      const top = lattice[rowA + colA] + (lattice[rowA + colB] - lattice[rowA + colA]) * sx;
      const bottom = lattice[rowB + colA] + (lattice[rowB + colB] - lattice[rowB + colA]) * sx;
      tile[y * size + x] += (top + (bottom - top) * sy) * amplitudeM;
    }
  }
}

/** Visits every tile pixel within `reachPx` of a centre, wrapping around the edges. */
function stamp(
  tile: Float32Array,
  centreX: number,
  centreY: number,
  reachPx: number,
  heightAt: (distancePx: number) => number,
): void {
  const size = DETAIL_SIZE;
  const reach = Math.ceil(reachPx);
  for (let dy = -reach; dy <= reach; dy++) {
    const y = (((Math.round(centreY) + dy) % size) + size) % size;
    for (let dx = -reach; dx <= reach; dx++) {
      const distance = Math.hypot(dx, dy);
      if (distance > reachPx) continue;
      const x = (((Math.round(centreX) + dx) % size) + size) % size;
      tile[y * size + x] += heightAt(distance);
    }
  }
}

/** Bowl-shaped craters with a raised rim; many small ones, few large ones, as on the real Moon. */
function addCraters(
  tile: Float32Array,
  tileM: number,
  count: number,
  minRadiusM: number,
  maxRadiusM: number,
  random: () => number,
): void {
  const pxPerM = DETAIL_SIZE / tileM;
  for (let i = 0; i < count; i++) {
    const radiusM = minRadiusM * Math.pow(maxRadiusM / minRadiusM, Math.pow(random(), 2.4));
    const radiusPx = radiusM * pxPerM;
    const freshness = 0.25 + 0.75 * random(); // old craters are shallow and soft
    const depthM = radiusM * 0.36 * freshness;
    const rimM = radiusM * 0.07 * freshness;
    stamp(tile, random() * DETAIL_SIZE, random() * DETAIL_SIZE, radiusPx * 2.4, (distancePx) => {
      const d = distancePx / radiusPx;
      if (d < 1) return depthM * (d * d - 1) + rimM;
      return rimM * Math.exp(-(d - 1) * 3.2) * (1 - (d - 1) / 1.4);
    });
  }
}

function addRocks(tile: Float32Array, tileM: number, count: number, random: () => number): void {
  const pxPerM = DETAIL_SIZE / tileM;
  for (let i = 0; i < count; i++) {
    const radiusM = 0.07 + 0.38 * Math.pow(random(), 3);
    const radiusPx = Math.max(1.5, radiusM * pxPerM);
    const heightM = radiusM * (0.5 + 0.5 * random());
    stamp(tile, random() * DETAIL_SIZE, random() * DETAIL_SIZE, radiusPx, (distancePx) => {
      const d = distancePx / radiusPx;
      return heightM * Math.sqrt(Math.max(0, 1 - d * d));
    });
  }
}

function buildMidTile(): Float32Array {
  const random = createRandom(4720);
  const tile = new Float32Array(DETAIL_SIZE * DETAIL_SIZE);
  addTileableNoise(tile, 5, 7, random);
  addTileableNoise(tile, 14, 2.4, random);
  addTileableNoise(tile, 46, 0.7, random);
  addCraters(tile, MID_TILE_M, 420, 9, 170, random);
  return tile;
}

function buildFineTile(): Float32Array {
  const random = createRandom(1969);
  const tile = new Float32Array(DETAIL_SIZE * DETAIL_SIZE);
  addTileableNoise(tile, 9, 0.22, random);
  addTileableNoise(tile, 36, 0.055, random);
  addTileableNoise(tile, 150, 0.014, random);
  addTileableNoise(tile, 420, 0.005, random);
  addCraters(tile, FINE_TILE_M, 230, 0.3, 6.5, random);
  addRocks(tile, FINE_TILE_M, 190, random);
  return tile;
}

/** Downloads the LOLA crop and builds everything the surface renderer needs. */
export async function loadSurfaceTerrain(url: string, cameraXM: number, cameraZM: number): Promise<SurfaceTerrain> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load the terrain file ${url} (HTTP ${response.status})`);
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength !== SOURCE_SIZE * SOURCE_SIZE * 2) {
    throw new Error(`Terrain file ${url} has an unexpected size (${bytes.byteLength} bytes)`);
  }
  // The file is little-endian 16-bit integers, metres above the 1737.4 km reference sphere.
  const view = new DataView(bytes);
  const source = new Int16Array(SOURCE_SIZE * SOURCE_SIZE);
  for (let i = 0; i < source.length; i++) source[i] = view.getInt16(i * 2, true);

  const base = upsampleSmooth(source);
  const baseSize = SOURCE_SIZE * UPSAMPLE;
  const baseCornerM = SOURCE_FIRST_SAMPLE_M - SOURCE_SPACING_M / 2;
  const baseSideM = SOURCE_SIZE * SOURCE_SPACING_M;

  // Store heights relative to the ground under the camera: numbers near zero keep the most
  // precision on the GPU, exactly where the viewer is looking most closely.
  const toIndex = (worldM: number) =>
    Math.min(baseSize - 1, Math.max(0, Math.floor(((worldM - baseCornerM) / baseSideM) * baseSize)));
  const cameraGroundM = base[toIndex(cameraZM) * baseSize + toIndex(cameraXM)];
  let maxHeightM = -Infinity;
  for (let i = 0; i < base.length; i++) {
    base[i] -= cameraGroundM;
    if (base[i] > maxHeightM) maxHeightM = base[i];
  }

  return {
    base,
    baseSize,
    baseCornerXM: baseCornerM,
    baseCornerZM: baseCornerM,
    baseSideM,
    mid: buildMidTile(),
    fine: buildFineTile(),
    detailSize: DETAIL_SIZE,
    maxHeightM: maxHeightM + 40, // head-room for the generated detail on top
  };
}
