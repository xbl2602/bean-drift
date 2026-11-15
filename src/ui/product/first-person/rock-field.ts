// 散落在地面上的石头：站在月面上，脚边和远处撒着大小不一的石块，这是第一人称里最直观的"真实感"。
// 石头的大小分布用月球着陆器勘测得出的经验规律（Golombek & Rapp 1997 的石块累计覆盖面积模型：
// F(D) = k · exp(-q·D)，q = 1.79 + 0.152/k，k 取 0.03 左右，比较典型的月海地面；石头越大越少，≥1 m 的很稀）。
// 具体每块石头的位置是按固定的随机种子撒的（不是测出来的），界面上同样注明是示意。
// 石头分两层：近处一层撒得密、石头小（0.1~0.6 m），远处一层石头大（0.6~4 m）；人走到哪里，就在哪里重新撒，所以到处都有。
import * as THREE from "three";

const DEFAULT_K = 0.03;

interface LayerConfig {
  /** 格子边长，每个格子里的石头由格子坐标决定，所以同一个地方每次撒的一样。 */
  cellM: number;
  /** 撒到离人多远。 */
  radiusM: number;
  minDiameterM: number;
  maxDiameterM: number;
  capacity: number;
}

const NEAR: LayerConfig = { cellM: 16, radiusM: 56, minDiameterM: 0.1, maxDiameterM: 0.6, capacity: 7000 };
const FAR: LayerConfig = { cellM: 64, radiusM: 320, minDiameterM: 0.6, maxDiameterM: 4, capacity: 3500 };

/** 石块的累计覆盖面积 F(D)（没有单位的比例），k 是总覆盖程度。 */
const coverage = (diameterM: number, k: number) => k * Math.exp(-(1.79 + 0.152 / k) * diameterM);

/** 把"面积分布"换成"个数分布"：返回每平方米有多少块 [minD, maxD] 的石头，以及按个数抽样的累计分布表。 */
function sizeDistribution(minDiameterM: number, maxDiameterM: number, k: number) {
  const steps = 64;
  const diameters: number[] = [];
  const cumulative: number[] = [];
  let total = 0;
  for (let i = 0; i < steps; i++) {
    const d0 = minDiameterM * Math.pow(maxDiameterM / minDiameterM, i / steps);
    const d1 = minDiameterM * Math.pow(maxDiameterM / minDiameterM, (i + 1) / steps);
    const dMid = Math.sqrt(d0 * d1);
    // 这一档的面积 = F(d0) - F(d1)；一块石头的面积 = π D² / 4
    total += Math.max(coverage(d0, k) - coverage(d1, k), 0) / ((Math.PI * dMid * dMid) / 4);
    diameters.push(dMid);
    cumulative.push(total);
  }
  return { perSquareMetre: total, pick: (u: number) => diameters[Math.min(cumulative.findIndex((c) => c >= u * total) >>> 0, steps - 1)] };
}

function hash2(ix: number, iy: number, seed: number): number {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ seed;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function random(seed: number) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** 一块有棱角的石头：压扁的二十面体，顶点随机凸凹，用平面着色，看上去是碎石而不是球。 */
function makeRockGeometry(seed: number): THREE.BufferGeometry {
  const base = new THREE.IcosahedronGeometry(0.5, 1);
  const rnd = random(seed);
  const jitter = new Map<string, number>();
  const position = base.getAttribute("position");
  const v = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i);
    const key = `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`;
    let scale = jitter.get(key);
    if (scale === undefined) jitter.set(key, (scale = 0.72 + rnd() * 0.5));
    v.multiplyScalar(scale);
    v.y *= 0.62; // 石头大多是扁的
    position.setXYZ(i, v.x, v.y, v.z);
  }
  const flat = base.toNonIndexed();
  flat.computeVertexNormals();
  return flat;
}

class RockLayer {
  readonly mesh: THREE.InstancedMesh;
  private readonly sizes;
  private readonly perCell: number;
  private lastEast = Infinity;
  private lastNorth = Infinity;

  constructor(private readonly config: LayerConfig, private readonly seed: number, k: number, geometry: THREE.BufferGeometry, material: THREE.Material) {
    this.sizes = sizeDistribution(config.minDiameterM, config.maxDiameterM, k);
    this.perCell = this.sizes.perSquareMetre * config.cellM * config.cellM;
    this.mesh = new THREE.InstancedMesh(geometry, material, config.capacity);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
  }

  /** 人站在 (east, north)：只有走出一小段才重新撒（石头位置在地上是固定的）。 */
  update(eastM: number, northM: number, surfaceYAt: (east: number, north: number) => number) {
    const move = Math.hypot(eastM - this.lastEast, northM - this.lastNorth);
    if (move < this.config.cellM * 0.3) return;
    this.lastEast = eastM;
    this.lastNorth = northM;
    const { cellM, radiusM, capacity } = this.config;
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const euler = new THREE.Euler();
    const color = new THREE.Color();
    let count = 0;
    const x0 = Math.floor((eastM - radiusM) / cellM);
    const x1 = Math.floor((eastM + radiusM) / cellM);
    const y0 = Math.floor((northM - radiusM) / cellM);
    const y1 = Math.floor((northM + radiusM) / cellM);
    for (let ix = x0; ix <= x1 && count < capacity; ix++) {
      for (let iy = y0; iy <= y1 && count < capacity; iy++) {
        const rnd = random(Math.imul(ix, 73856093) ^ Math.imul(iy, 19349663) ^ this.seed);
        // 石头成片出现：有的地方密、有的地方稀（用格子坐标的低频随机数调整数量）
        const patch = 0.35 + 1.3 * hash2(Math.floor(ix / 3), Math.floor(iy / 3), this.seed + 7);
        const n = Math.floor(this.perCell * patch + rnd());
        for (let i = 0; i < n && count < capacity; i++) {
          const east = (ix + rnd()) * cellM;
          const north = (iy + rnd()) * cellM;
          const distance = Math.hypot(east - eastM, north - northM);
          const diameterM = this.sizes.pick(rnd());
          const rotationY = rnd() * Math.PI * 2;
          const tilt = (rnd() - 0.5) * 0.5;
          const shade = rnd();
          if (distance > radiusM) continue;
          // 远处太小的石头画出来只是闪烁的点：按"在眼里至少有一两个像素"取舍
          if (diameterM < distance * 0.0022) continue;
          const lengthM = diameterM * (0.8 + rnd() * 0.7);
          const heightM = diameterM * 0.62;
          quaternion.setFromEuler(euler.set(tilt, rotationY, tilt * 0.6));
          // 石头埋进土里一点
          matrix.compose(new THREE.Vector3(east, surfaceYAt(east, north) + heightM * 0.12, -north), quaternion, new THREE.Vector3(lengthM, diameterM, diameterM * (0.7 + 0.3 * shade)));
          this.mesh.setMatrixAt(count, matrix);
          // 灰色略有深浅，少数偏暖（风化的玄武岩 / 角砾岩）；反照率 0.08-0.22，和真实月岩差不多（玄武岩暗、角砾岩亮）
          const grey = 0.08 + 0.14 * shade;
          this.mesh.setColorAt(count, color.setRGB(grey * 1.03, grey, grey * 0.94));
          count++;
        }
      }
    }
    this.mesh.count = count;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

export interface RockField {
  group: THREE.Group;
  /** 人站的位置（本地坐标 east / north，米）。 */
  update: (eastM: number, northM: number) => void;
  dispose: () => void;
}

export function createRockField(surfaceYAt: (eastM: number, northM: number) => number, seed: number, k = DEFAULT_K): RockField {
  const geometry = makeRockGeometry(seed ^ 0x5bd1e995);
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.96, metalness: 0 });
  const layers = [new RockLayer(NEAR, seed ^ 0x1234, k, geometry, material), new RockLayer(FAR, seed ^ 0x9876, k, geometry, material)];
  const group = new THREE.Group();
  for (const layer of layers) group.add(layer.mesh);
  return {
    group,
    update: (eastM, northM) => layers.forEach((layer) => layer.update(eastM, northM, surfaceYAt)),
    dispose: () => {
      geometry.dispose();
      material.dispose();
      layers.forEach((layer) => layer.mesh.dispose());
    },
  };
}
