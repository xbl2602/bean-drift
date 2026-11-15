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
}

/** 从 origin 出发，沿方位角 bearingRad（正北 0，向东为正）走角距离 deltaRad，到达的经纬度。 */
function destination(origin: LatLon, bearingRad: number, deltaRad: number): LatLon {
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

export function buildTerrainPatch(center: LatLon, field: HeightField, detail: TerrainDetail, radiusM: number): TerrainPatch {
  const radii = ringRadii(radiusM);
  const vertexCount = 1 + radii.length * SECTORS;
  const groundHeightM = field.heightAtM(center.latDeg, center.lonDeg);
  const footOffsetM = detail.heightM(0, 0, FIRST_RING_M);
  const basis = localBasis(center);
  const origin = basis.up.clone().multiplyScalar(MOON_RADIUS_M + groundHeightM);

  const positions = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
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
  radii.forEach((ringM, ring) => {
    const cellM = ringM * (RING_GROWTH - 1);
    for (let s = 0; s < SECTORS; s++) {
      const bearingRad = (s / SECTORS) * 2 * Math.PI;
      const point = destination(center, bearingRad, ringM / MOON_RADIUS_M);
      // 经度不取模，保证跨过 ±180° 时贴图坐标连续（贴图是 RepeatWrapping）
      const lonDeg = center.lonDeg + (((point.lonDeg - center.lonDeg + 540) % 360) - 180);
      const detailM = detail.heightM(Math.sin(bearingRad) * ringM, Math.cos(bearingRad) * ringM, cellM);
      writeVertex(1 + ring * SECTORS + s, point, lonDeg, detailM);
    }
  });

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
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  return { chunks: splitIntoChunks(geometry, radii.length), groundHeightM, footOffsetM };
}

/**
 * 把整块地形按"扇形 × 环带"切成小块。每块有自己的三角形索引和包围球，three 会对每块单独做视锥体剔除：
 * 背后、视野外的块不进绘制；阴影相机只有几公里宽，远处的块也不进阴影图。顶点数据共用，不多占内存。
 */
function splitIntoChunks(full: THREE.BufferGeometry, ringCount: number): THREE.BufferGeometry[] {
  const position = full.getAttribute("position") as THREE.BufferAttribute;
  const normal = full.getAttribute("normal");
  const uv = full.getAttribute("uv");
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
      chunk.setIndex(new THREE.BufferAttribute(new Uint32Array(indexList), 1));
      chunk.boundingSphere = boundingSphereOfIndexed(position, indexList);
      chunks.push(chunk);
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
