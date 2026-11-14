// 【示意用，不是数据】第一人称近处的地表细节：小起伏和小撞击坑。
// 全月 LOLA 高度约 1.9 km 一个像素，站在地面上近处会是一片光滑的面。这里用固定随机种子生成比 LOLA 分辨率更小的细节，
// 让画面有尺度感。它不代表该位置真实的石头和坑，界面上必须注明 "illustrative"。大地形和所有阴影计算仍然用真实 LOLA。

/** 小起伏的最大波长：比这更大的形状应该由真实 LOLA 数据来表达。 */
const MAX_WAVELENGTH_M = 1000;
const MIN_WAVELENGTH_M = 4;
/** 每个波长的起伏幅度 = 波长 × 这个比例（1 km 波长约 ±12 m）。 */
const ROUGHNESS = 0.012;
const CRATER_COUNT = 240;
const CRATER_FIELD_RADIUS_M = 2600;
const CRATER_MIN_RADIUS_M = 3;
const CRATER_MAX_RADIUS_M = 220;

interface Crater {
  eastM: number;
  northM: number;
  radiusM: number;
}

export interface TerrainDetail {
  /** 细节高度（米），叠加在 LOLA 高度上。cellM 是该处网格的边长：比网格还细的细节会被去掉，避免锯齿。 */
  heightM: (eastM: number, northM: number, cellM: number) => number;
}

function seededRandom(seed: number) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** 整数格点上的伪随机数（0..1），和 seed 有关。 */
function latticeValue(ix: number, iy: number, seed: number): number {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ seed;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** 平滑插值的格点噪声，返回 -1..1。 */
function valueNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = latticeValue(ix, iy, seed);
  const b = latticeValue(ix + 1, iy, seed);
  const c = latticeValue(ix, iy + 1, seed);
  const d = latticeValue(ix + 1, iy + 1, seed);
  return (a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy) * 2 - 1;
}

const smooth = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
};

/** 简单撞击坑的剖面：碗形坑底 + 略微隆起的坑沿，向外衰减。rho = 离坑心距离 / 坑半径。 */
function craterProfileM(rho: number, radiusM: number): number {
  const depthM = radiusM * 2 * 0.12;
  const rimM = radiusM * 2 * 0.03;
  if (rho <= 1) return -depthM + (depthM + rimM) * rho * rho;
  return rho < 3 ? rimM * Math.pow(rho, -3) * (1 - smooth(2.2, 3, rho)) : 0;
}

/** seed 由经纬度决定：同一个地点每次生成的细节一样。 */
export function createTerrainDetail(latDeg: number, lonDeg: number): TerrainDetail {
  const seed = (Math.round((latDeg + 90) * 1000) * 73856093) ^ (Math.round((lonDeg + 180) * 1000) * 19349663);
  const random = seededRandom(seed);
  const craters: Crater[] = [];
  for (let i = 0; i < CRATER_COUNT; i++) {
    // 数量随直径按幂律减少：小坑多、大坑少
    const radiusM = Math.min(CRATER_MIN_RADIUS_M / Math.sqrt(random() + 1e-4), CRATER_MAX_RADIUS_M);
    const distanceM = Math.sqrt(random()) * CRATER_FIELD_RADIUS_M;
    const angle = random() * Math.PI * 2;
    craters.push({ eastM: Math.cos(angle) * distanceM, northM: Math.sin(angle) * distanceM, radiusM });
  }

  return {
    heightM(eastM, northM, cellM) {
      let h = 0;
      for (let wavelengthM = MAX_WAVELENGTH_M, octave = 0; wavelengthM >= MIN_WAVELENGTH_M; wavelengthM /= 2, octave++) {
        const keep = smooth(2 * cellM, 4 * cellM, wavelengthM);
        if (keep <= 0) break;
        h += valueNoise(eastM / wavelengthM, northM / wavelengthM, seed + octave * 1013) * wavelengthM * ROUGHNESS * keep;
      }
      if (Math.hypot(eastM, northM) < CRATER_FIELD_RADIUS_M + 3 * CRATER_MAX_RADIUS_M) {
        for (const crater of craters) {
          if (crater.radiusM < 2 * cellM) continue;
          const rho = Math.hypot(eastM - crater.eastM, northM - crater.northM) / crater.radiusM;
          if (rho < 3) h += craterProfileM(rho, crater.radiusM);
        }
      }
      return h;
    },
  };
}

/** 可平铺的细颗粒噪声贴图（月壤颗粒感），R 通道 0..255。 */
export function createGrainPixels(size: number): Uint8Array {
  const pixels = new Uint8Array(size * size);
  const octaves = [4, 8, 16, 32, 64, 128];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let value = 0;
      let weight = 0;
      octaves.forEach((cells, o) => {
        const amplitude = 1 / (o + 1);
        const fx = (x / size) * cells;
        const fy = (y / size) * cells;
        const ix = Math.floor(fx);
        const iy = Math.floor(fy);
        const tx = fx - ix;
        const ty = fy - iy;
        const sx = tx * tx * (3 - 2 * tx);
        const sy = ty * ty * (3 - 2 * ty);
        // 格点坐标对 cells 取模，贴图首尾才能无缝拼接
        const at = (gx: number, gy: number) => latticeValue(gx % cells, gy % cells, 977 + o * 131);
        const top = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * sx;
        const bottom = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * sx;
        value += (top + (bottom - top) * sy) * amplitude;
        weight += amplitude;
      });
      pixels[y * size + x] = Math.round((value / weight) * 255);
    }
  }
  return pixels;
}
