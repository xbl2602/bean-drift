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

export interface TerrainPatch {
  geometry: THREE.BufferGeometry;
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
  return { geometry, groundHeightM, footOffsetM, surfaceYAt: (eastM, northM) => surfaceYOnGrid(positions, radii, eastM, northM) };
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
