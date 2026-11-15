// 第一人称近处的地表细节：真实撞击坑 + 统计上真实的小坑和小起伏。
// 全月 LOLA 高度约 1.9 km 一个像素，站在地面上近处会是一片光滑的面。这里补三样东西：
//  1. 真实撞击坑：直径 ≥ 1 km 的坑来自 Robbins 月球撞击坑数据库（crater-catalog.ts），位置、大小都是实测的；
//  2. 更小的坑（8 m ~ 1 km）：数据库里没有，按真实的规律生成——数量随直径的 -2.2 次方减少，并且按本地真实大坑的密度
//     定标（大坑多的地方小坑也多）；固定随机种子，同一个地点每次一样。它们的"位置"不是实测的，界面上要注明；
//  3. 小起伏：几米到一公里的缓坡（示意）。
// 坑的形状按月球撞击坑的统计形态：简单坑深径比约 0.2（新）到 0.03（老，被填平），坑沿隆起，溅射毯按 r^-3 衰减；
// 直径超过 18 km 的复杂坑浅得多、底部平坦（Pike 1977 的深径比经验式）。大地形和所有阴影计算仍然用真实 LOLA。
import type { RealCrater } from "./crater-catalog";

/** 小起伏的最大波长：比这更大的形状应该由真实 LOLA 数据来表达。 */
const MAX_WAVELENGTH_M = 4000;
const MIN_WAVELENGTH_M = 4;
/** 每个波长的起伏幅度 = 波长 × 这个比例（1 km 波长约 ±12 m）。 */
const ROUGHNESS = 0.006;
/** 较长的波长（几百米到几公里的缓坡、小丘）起伏更明显：真实月面上最显眼的就是这种柔和起伏的丘陵（阿波罗 15 号照片里的样子）。 */
const ROUGHNESS_ROLLING = 0.009;
/** 生成小坑的范围：半径 4 m ~ 400 m，只铺在人周围这么远的地方（更远的小坑本来也看不清）。 */
const SMALL_MIN_RADIUS_M = 4;
const SMALL_MAX_RADIUS_M = 400;
const SMALL_FIELD_RADIUS_M = 2200;
const SMALL_MAX_COUNT = 14_000;
/** 清晰的新坑（直径 25~160 m）：在人周围一定会有几个，站在哪里都能一眼看到"这里有坑"。 */
const HERO_CRATER_COUNT = 14;
/** 中等大小的坑（直径 40~400 m）：远近各处都有，让整片地面看上去有坑坑洼洼的层次。 */
const MID_CRATER_COUNT = 140;
/** 脚边的小坑（直径 14~70 m，离人 20~330 m）：走几步就能碰到，近处也有坑坑洼洼。 */
const NEAR_CRATER_COUNT = 70;
/** 小坑的数量随直径的这个次方减少（累计分布 N(>D) ∝ D^-2.2）。 */
const SIZE_EXPONENT = 2.2;
/** 半径超过这个值的坑放进"大坑表"逐个检查，其余的放进空间格子里。 */
const BIG_CRATER_RADIUS_M = 1500;
const GRID_CELL_M = 200;
/** 格子范围：覆盖 ±GRID_HALF 个格子（约 ±3.5 km 以内的小坑和中坑）。 */
const GRID_HALF = 18;

interface Crater {
  eastM: number;
  northM: number;
  radiusM: number;
  /** 0 老、磨损 ~ 1 新、清晰。 */
  crispness: number;
}

export interface TerrainDetail {
  /** 细节高度（米），叠加在 LOLA 高度上。cellM 是该处网格的边长：比网格还细的细节会被去掉，避免锯齿。 */
  heightM: (eastM: number, northM: number, cellM: number) => number;
  /** 同一处地面的明暗倍数（新坑的亮溅射物、老坑的暗坑底），乘在底图颜色上。 */
  albedoAt: (eastM: number, northM: number, cellM: number) => number;
  /** 用到的真实坑数 / 生成的小坑数（给界面说明用）。 */
  counts: { real: number; generated: number };
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

/**
 * 撞击坑剖面（米）：rho = 离坑心距离 / 坑半径。
 * 碗形坑底 + 隆起的坑沿 + 向外按 r^-3 衰减的溅射毯；复杂坑底部平、有中央峰。越新越深、越陡、坑沿越高。
 */
function craterProfileM(rho: number, radiusM: number, crispness: number): number {
  const diameterM = radiusM * 2;
  const complex = diameterM > 18_000;
  const depthRatio = (0.025 + 0.18 * Math.pow(crispness, 1.2)) * (complex ? (1.044 * Math.pow(diameterM / 1000, -0.699)) / 0.2 : 1);
  // 比统计值略深一点：站在地面上（眼睛只有 1.6 m 高），统计上真实的浅坑几乎看不出来
  const depthM = diameterM * depthRatio * (complex ? 1 : 1.3);
  // 坑沿隆起：新鲜的简单坑约为直径的 3.6%（Pike 1977 的经验式），老坑被磨低
  const rimM = diameterM * (0.01 + 0.026 * crispness);
  const rimWidth = 0.35 - 0.22 * crispness;
  let h = rimM * Math.exp(-(((rho - 1) / rimWidth) ** 2));
  // 溅射毯：坑沿外按 r^-3 衰减。坑沿里面也要接上（从坑心的 0 一路抬到坑沿的值），
  // 否则坑沿处会有一道几十到几百米高的"悬崖"，画面上就是一整面带竖条纹的墙。
  const ejectaM = rimM * 0.55 * (0.4 + 0.6 * crispness);
  h += rho < 1 ? ejectaM * Math.pow(rho, 4) : ejectaM * Math.pow(rho, -3) * (1 - smooth(2.2, 3, rho));
  if (rho < 1) {
    h -= depthM * (1 - Math.pow(rho, complex ? 3.6 : 2));
    if (complex && diameterM > 22_000) h += 0.22 * depthM * Math.exp(-((rho / 0.13) ** 2)); // 中央峰
  }
  return h;
}

/**
 * 坑附近的地面明暗（乘在底图颜色上，1 = 不变）：新坑的溅射物和坑沿又亮又白，老坑的坑底被填平、略暗。
 * 这样即使太阳很高、没有长长的影子，坑和坑沿也能看出来。
 */
function craterShade(rho: number, crispness: number): number {
  if (rho < 1) return 1 - 0.14 * (1 - crispness) * (1 - rho * rho) + 0.1 * crispness * rho * rho;
  return 1 + 0.5 * Math.pow(crispness, 1.4) * Math.exp(-(((rho - 1.15) / 0.8) ** 2)) * (1 - smooth(2.2, 3, rho));
}

/** 大于几公里的坑，LOLA 的 1.9 km 网格已经表达了大部分形状；这里把细节幅度逐渐收小，避免重复叠加。 */
const lolaCovers = (radiusM: number) => 1 - 0.8 * smooth(4000, 14_000, radiusM);

/**
 * seed 由经纬度决定：同一个地点每次生成的细节一样。
 * realCraters：观察点周围的真实撞击坑（东、北距离，米）；还没加载到时传空数组，只剩生成的细节。
 */
export function createTerrainDetail(latDeg: number, lonDeg: number, realCraters: readonly RealCrater[] = [], realRadiusM = 30_000): TerrainDetail {
  const seed = (Math.round((latDeg + 90) * 1000) * 73856093) ^ (Math.round((lonDeg + 180) * 1000) * 19349663);
  const random = seededRandom(seed);

  const big: Crater[] = [];
  const grid = new Map<number, Crater[]>();
  const cellKey = (ix: number, iy: number) => (ix + GRID_HALF + 2) * 1024 + (iy + GRID_HALF + 2);
  const add = (crater: Crater) => {
    if (crater.radiusM >= BIG_CRATER_RADIUS_M) {
      big.push(crater);
      return;
    }
    const reach = crater.radiusM * 3;
    const x0 = Math.floor((crater.eastM - reach) / GRID_CELL_M);
    const x1 = Math.floor((crater.eastM + reach) / GRID_CELL_M);
    const y0 = Math.floor((crater.northM - reach) / GRID_CELL_M);
    const y1 = Math.floor((crater.northM + reach) / GRID_CELL_M);
    for (let ix = Math.max(x0, -GRID_HALF); ix <= Math.min(x1, GRID_HALF); ix++) {
      for (let iy = Math.max(y0, -GRID_HALF); iy <= Math.min(y1, GRID_HALF); iy++) {
        const key = cellKey(ix, iy);
        const list = grid.get(key);
        if (list) list.push(crater);
        else grid.set(key, [crater]);
      }
    }
  };

  // 1. 真实坑
  let realNear = 0;
  for (const c of realCraters) {
    // 数据库里"坑沿被识别出的比例"大多在 0.5~1 之间：拉开到 0~1，新旧坑的差别才明显
    add({ eastM: c.eastM, northM: c.northM, radiusM: c.radiusM, crispness: Math.min(Math.max((c.crispness - 0.35) / 0.55, 0), 1) });
    if (Math.hypot(c.eastM, c.northM) < realRadiusM && c.radiusM * 2 >= 1000) realNear++;
  }

  // 2. 按本地真实大坑的密度定标的小坑：数量随直径 -2.2 次方减少
  const areaKm2 = Math.PI * (realRadiusM / 1000) ** 2;
  const density1km = realCraters.length > 0 ? Math.min(Math.max(realNear / areaKm2, 0.02), 0.15) : 0.04;
  const smallAreaKm2 = Math.PI * (SMALL_FIELD_RADIUS_M / 1000) ** 2;
  const dMin = (SMALL_MIN_RADIUS_M * 2) / 1000;
  const dMax = (SMALL_MAX_RADIUS_M * 2) / 1000;
  const wanted = Math.min(SMALL_MAX_COUNT, Math.round(density1km * smallAreaKm2 * (Math.pow(dMin, -SIZE_EXPONENT) - Math.pow(dMax, -SIZE_EXPONENT))));
  let generated = 0;
  for (let i = 0; i < wanted; i++) {
    // 反解累计分布：直径 D 满足 N(>D) ∝ D^-2.2
    const diameterKm = Math.pow(Math.pow(dMin, -SIZE_EXPONENT) - random() * (Math.pow(dMin, -SIZE_EXPONENT) - Math.pow(dMax, -SIZE_EXPONENT)), -1 / SIZE_EXPONENT);
    const distanceM = Math.sqrt(random()) * SMALL_FIELD_RADIUS_M;
    const angle = random() * Math.PI * 2;
    add({ eastM: Math.cos(angle) * distanceM, northM: Math.sin(angle) * distanceM, radiusM: (diameterKm * 1000) / 2, crispness: Math.pow(random(), 1.3) });
    generated++;
  }
  for (let i = 0; i < HERO_CRATER_COUNT; i++) {
    // 均匀分布在各个方向上，离人 70 m ~ 700 m；直径 25 ~ 160 m，几乎都是新坑
    const angle = ((i + random() * 0.8) / HERO_CRATER_COUNT) * Math.PI * 2;
    const distanceM = 45 + Math.pow(random(), 1.3) * 400;
    const diameterM = 22 * Math.pow(130 / 22, random());
    add({ eastM: Math.cos(angle) * distanceM, northM: Math.sin(angle) * distanceM, radiusM: diameterM / 2, crispness: 0.7 + 0.3 * random() });
    generated++;
  }
  for (let i = 0; i < NEAR_CRATER_COUNT; i++) {
    const diameterM = 14 * Math.pow(70 / 14, random());
    const distanceM = 20 + Math.sqrt(random()) * 310;
    const angle = random() * Math.PI * 2;
    add({ eastM: Math.cos(angle) * distanceM, northM: Math.sin(angle) * distanceM, radiusM: diameterM / 2, crispness: 0.35 + 0.65 * Math.pow(random(), 0.9) });
    generated++;
  }
  for (let i = 0; i < MID_CRATER_COUNT; i++) {
    const diameterM = 40 * Math.pow(400 / 40, random());
    const distanceM = 90 + Math.sqrt(random()) * 1900;
    const angle = random() * Math.PI * 2;
    add({ eastM: Math.cos(angle) * distanceM, northM: Math.sin(angle) * distanceM, radiusM: diameterM / 2, crispness: 0.25 + 0.75 * Math.pow(random(), 1.2) });
    generated++;
  }

  /** 对 (east, north) 附近每个够大的坑调用一次 visit(坑, rho)。 */
  const visitCraters = (eastM: number, northM: number, cellM: number, visit: (crater: Crater, rho: number) => void) => {
    for (const crater of big) {
      if (crater.radiusM < 2 * cellM) continue;
      const rho = Math.hypot(eastM - crater.eastM, northM - crater.northM) / crater.radiusM;
      if (rho < 3) visit(crater, rho);
    }
    const ix = Math.floor(eastM / GRID_CELL_M);
    const iy = Math.floor(northM / GRID_CELL_M);
    if (ix < -GRID_HALF || ix > GRID_HALF || iy < -GRID_HALF || iy > GRID_HALF) return;
    const list = grid.get(cellKey(ix, iy));
    if (!list) return;
    for (const crater of list) {
      if (crater.radiusM < 2 * cellM) continue;
      const rho = Math.hypot(eastM - crater.eastM, northM - crater.northM) / crater.radiusM;
      if (rho < 3) visit(crater, rho);
    }
  };

  return {
    counts: { real: realNear, generated },
    heightM(eastM, northM, cellM) {
      let h = 0;
      // 3. 小起伏
      for (let wavelengthM = MAX_WAVELENGTH_M, octave = 0; wavelengthM >= MIN_WAVELENGTH_M; wavelengthM /= 2, octave++) {
        const keep = smooth(2 * cellM, 4 * cellM, wavelengthM);
        if (keep <= 0) break;
        h += valueNoise(eastM / wavelengthM, northM / wavelengthM, seed + octave * 1013) * wavelengthM * (ROUGHNESS + ROUGHNESS_ROLLING * smooth(300, 2500, wavelengthM)) * keep;
      }
      visitCraters(eastM, northM, cellM, (crater, rho) => {
        h += craterProfileM(rho, crater.radiusM, crater.crispness) * (crater.radiusM >= BIG_CRATER_RADIUS_M ? lolaCovers(crater.radiusM) : 1);
      });
      return h;
    },
    albedoAt(eastM, northM, cellM) {
      let tone = 1;
      visitCraters(eastM, northM, cellM, (crater, rho) => {
        tone *= craterShade(rho, crater.crispness);
      });
      return Math.min(Math.max(tone, 0.7), 1.6);
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
