// 以观察点为中心的一块地形网格（极坐标网格：一圈圈同心环 × 256 个方向）。
// 环的半径按等比数列增长：脚下每格不到 1 m，200 km 外每格约 5 km。这样近处够细、远处不浪费顶点。
// 每个顶点先沿大圆走到对应的经纬度、取真实 LOLA 高度、放回月球上，再换算到观察点的本地坐标
// （x 东、y 上、z 南，单位米）。所以月球曲率是真实的：远处地面会自然沉到地平线下。
// 近处另外叠加 terrain-detail.ts 的示意细节（非数据）。
import * as THREE from "three";
import { MOON_RADIUS_M } from "../moon-assets";
import { latLonToBody, localBasis, type LatLon } from "../moon-frames";
import type { HeightField } from "./height-tiles";
import type { TerrainDetail } from "./terrain-detail";
import { noSlice, type Slice } from "./time-slice";

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;
const SECTORS = 256;
const FIRST_RING_M = 0.75;
const RING_GROWTH = 1.026;

/** 地形按方向切成这么多个扇形、按距离切成这么多条环带，每块单独判断"看不看得见"：背后和视野外的块不画。 */
const CHUNK_SECTORS = 16;
const CHUNK_BANDS = 4;

export interface TerrainPatch {
  /** 地形网格，已切成若干块（共用同一份顶点数据，各自只有自己的三角形索引和包围球）。 */
  chunks: THREE.BufferGeometry[];
  /** 观察点脚下的 LOLA 地面高度（米，相对参考球）。实测值，不含示意细节。 */
  groundHeightM: number;
  /** 观察点脚下示意细节的高度（米）：眼睛高度要在它之上，否则会站进地里。 */
  footOffsetM: number;
  /** 网格表面在本地坐标 (east, north) 处的高度 y（米，和网格同一坐标系）。走动时用来让眼睛贴着地面。 */
  surfaceYAt: (eastM: number, northM: number) => number;
}

/** 从 origin 出发，沿方位角 bearingRad（正北 0，向东为正）走角距离 deltaRad，到达的经纬度。 */
export function destination(origin: LatLon, bearingRad: number, deltaRad: number): LatLon {
  const lat1 = origin.latDeg * D2R;
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(deltaRad) + Math.cos(lat1) * Math.sin(deltaRad) * Math.cos(bearingRad));
  const dLon = Math.atan2(Math.sin(bearingRad) * Math.sin(deltaRad) * Math.cos(lat1), Math.cos(deltaRad) - Math.sin(lat1) * Math.sin(lat2));
  return { latDeg: lat2 * R2D, lonDeg: origin.lonDeg + dLon * R2D };
}

function ringRadii(maxRadiusM: number): number[] {
  const radii: number[] = [];
  for (let r = FIRST_RING_M; r < maxRadiusM; r *= RING_GROWTH) radii.push(r);
  radii.push(maxRadiusM);
  return radii;
}

/** slice：长循环里每圈调用一次，让调用方有机会把主线程让出去（不传就是一口气算完）。 */
export async function buildTerrainPatch(center: LatLon, field: HeightField, detail: TerrainDetail, radiusM: number, slice: Slice = noSlice): Promise<TerrainPatch> {
  const radii = ringRadii(radiusM);
  const vertexCount = 1 + radii.length * SECTORS;
  const groundHeightM = field.heightAtM(center.latDeg, center.lonDeg);
  const footOffsetM = detail.heightM(0, 0, FIRST_RING_M);
  const basis = localBasis(center);
  const origin = basis.up.clone().multiplyScalar(MOON_RADIUS_M + groundHeightM);

  const positions = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  // 顶点颜色：只有明暗（新坑的亮溅射物、老坑的暗坑底），乘在底图颜色上
  const tones = new Float32Array(vertexCount * 3).fill(1);
  const p = new THREE.Vector3();
  const writeVertex = (index: number, point: LatLon, lonDeg: number, detailM: number) => {
    const heightM = field.heightAtM(point.latDeg, lonDeg) + detailM;
    p.copy(latLonToBody({ latDeg: point.latDeg, lonDeg })).multiplyScalar(MOON_RADIUS_M + heightM).sub(origin);
    positions[index * 3] = p.dot(basis.east);
    positions[index * 3 + 1] = p.dot(basis.up);
    positions[index * 3 + 2] = -p.dot(basis.north);
    uvs[index * 2] = (lonDeg + 180) / 360;
    uvs[index * 2 + 1] = (point.latDeg + 90) / 180;
  };

  writeVertex(0, center, center.lonDeg, footOffsetM);
  for (let ring = 0; ring < radii.length; ring++) {
    const ringM = radii[ring];
    const cellM = ringM * (RING_GROWTH - 1);
    for (let s = 0; s < SECTORS; s++) {
      const bearingRad = (s / SECTORS) * 2 * Math.PI;
      const point = destination(center, bearingRad, ringM / MOON_RADIUS_M);
      // 经度不取模，保证跨过 ±180° 时贴图坐标连续（贴图是 RepeatWrapping）
      const lonDeg = center.lonDeg + (((point.lonDeg - center.lonDeg + 540) % 360) - 180);
      const detailM = detail.heightM(Math.sin(bearingRad) * ringM, Math.cos(bearingRad) * ringM, cellM);
      writeVertex(1 + ring * SECTORS + s, point, lonDeg, detailM);
      const tone = detail.albedoAt(Math.sin(bearingRad) * ringM, Math.cos(bearingRad) * ringM, cellM);
      const at = (1 + ring * SECTORS + s) * 3;
      tones[at] = tone;
      tones[at + 1] = tone;
      tones[at + 2] = tone * 0.985;
    }
    await slice();
  }

  // 中心一圈扇形 + 相邻两环之间的四边形（各拆成两个三角形）。绕向：从上往下看逆时针，法线朝上。
  const indices = new Uint32Array(SECTORS * 3 + (radii.length - 1) * SECTORS * 6);
  let n = 0;
  for (let s = 0; s < SECTORS; s++) {
    indices.set([0, 1 + ((s + 1) % SECTORS), 1 + s], n);
    n += 3;
  }
  for (let ring = 0; ring < radii.length - 1; ring++) {
    for (let s = 0; s < SECTORS; s++) {
      const a = 1 + ring * SECTORS + s;
      const b = 1 + ring * SECTORS + ((s + 1) % SECTORS);
      const c = a + SECTORS;
      const d = b + SECTORS;
      indices.set([a, b, c, b, d, c], n);
      n += 6;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.setAttribute("color", new THREE.BufferAttribute(tones, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  await slice();
  geometry.computeVertexNormals();
  await slice();
  return { chunks: await splitIntoChunks(geometry, radii.length, slice), groundHeightM, footOffsetM, surfaceYAt: (eastM, northM) => surfaceYOnGrid(positions, radii, eastM, northM) };
}

/**
 * 把整块地形按"扇形 × 环带"切成小块。每块有自己的三角形索引和包围球，three 会对每块单独做视锥体剔除：
 * 背后、视野外的块不进绘制；阴影相机只有几公里宽，远处的块也不进阴影图。顶点数据共用，不多占内存。
 */
async function splitIntoChunks(full: THREE.BufferGeometry, ringCount: number, slice: Slice): Promise<THREE.BufferGeometry[]> {
  const position = full.getAttribute("position") as THREE.BufferAttribute;
  const normal = full.getAttribute("normal");
  const uv = full.getAttribute("uv");
  const color = full.getAttribute("color");
  const fullIndex = full.getIndex()!.array as Uint32Array;
  const quadRings = ringCount - 1;
  const chunks: THREE.BufferGeometry[] = [];
  for (let band = 0; band < CHUNK_BANDS; band++) {
    const ringStart = Math.floor((band * quadRings) / CHUNK_BANDS);
    const ringEnd = Math.floor(((band + 1) * quadRings) / CHUNK_BANDS); // 不含
    for (let sector = 0; sector < CHUNK_SECTORS; sector++) {
      const s0 = (sector * SECTORS) / CHUNK_SECTORS;
      const s1 = ((sector + 1) * SECTORS) / CHUNK_SECTORS; // 不含
      const indexList: number[] = [];
      if (band === 0) {
        for (let s = s0; s < s1; s++) indexList.push(...fullIndex.subarray(s * 3, s * 3 + 3)); // 中心一圈扇形只属于第一条环带
      }
      for (let ring = ringStart; ring < ringEnd; ring++) {
        const base = SECTORS * 3 + ring * SECTORS * 6;
        for (let s = s0; s < s1; s++) indexList.push(...fullIndex.subarray(base + s * 6, base + s * 6 + 6));
      }
      const chunk = new THREE.BufferGeometry();
      chunk.setAttribute("position", position);
      chunk.setAttribute("normal", normal);
      chunk.setAttribute("uv", uv);
      chunk.setAttribute("color", color);
      chunk.setIndex(new THREE.BufferAttribute(new Uint32Array(indexList), 1));
      chunk.boundingSphere = boundingSphereOfIndexed(position, indexList);
      chunks.push(chunk);
      await slice();
    }
  }
  return chunks;
}

/** 只按这块用到的顶点算包围球（BufferGeometry 自带的会把整张顶点表都算进去）。 */
function boundingSphereOfIndexed(position: THREE.BufferAttribute, indexList: number[]): THREE.Sphere {
  const box = new THREE.Box3();
  const p = new THREE.Vector3();
  const used = new Set(indexList);
  used.forEach((index) => box.expandByPoint(p.fromBufferAttribute(position, index)));
  return box.getBoundingSphere(new THREE.Sphere());
}

/**
 * 在极坐标网格上按 (半径, 方位) 双线性插值取表面高度 y。
 * 网格顶点的水平位置因为月球曲率会略微偏离理想的同心圆，几公里以内差别不到厘米，可以忽略。
 */
function surfaceYOnGrid(positions: Float32Array, radii: number[], eastM: number, northM: number): number {
  const y = (index: number) => positions[index * 3 + 1];
  const r = Math.hypot(eastM, northM);
  const bearing = (Math.atan2(eastM, northM) + 2 * Math.PI) % (2 * Math.PI);
  const sectorF = (bearing / (2 * Math.PI)) * SECTORS;
  const s0 = Math.floor(sectorF) % SECTORS;
  const s1 = (s0 + 1) % SECTORS;
  const ts = sectorF - Math.floor(sectorF);
  const onRing = (ring: number) => y(1 + ring * SECTORS + s0) * (1 - ts) + y(1 + ring * SECTORS + s1) * ts;
  if (r <= radii[0]) return y(0) + (onRing(0) - y(0)) * (r / radii[0]);
  const last = radii.length - 1;
  let ring = Math.min(Math.max(Math.floor(Math.log(r / FIRST_RING_M) / Math.log(RING_GROWTH)), 0), last - 1);
  while (ring > 0 && radii[ring] > r) ring--;
  while (ring < last - 1 && radii[ring + 1] < r) ring++;
  const tr = Math.min(Math.max((r - radii[ring]) / (radii[ring + 1] - radii[ring]), 0), 1);
  return onRing(ring) * (1 - tr) + onRing(ring + 1) * tr;
}
