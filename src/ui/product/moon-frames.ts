// 月固坐标系、three.js 坐标系、经纬度之间的换算，以及"某时刻太阳在月固系里的方向"。
// 星历只用 src/core 里唯一的那份实现（skyAtLatLon），这里只做坐标变换，不重新算星历。
//
// 月固系（Body）：x 指向经纬 0/0，y 指向东经 90°，z 指向北极。
// three.js 场景：y 朝上 = 北极；Body (x, y, z) -> three (x, z, -y)。
// 这样 three 的 SphereGeometry 的 u 从 0.5 往 0.75 正好是东经 0° 到 90°，和贴图的简单圆柱投影一致。
import * as THREE from "three";
import { skyAtLatLon } from "@/core/ephemeris/ephemeris";

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

export interface LatLon {
  latDeg: number;
  lonDeg: number;
}

export function normalizeLonDeg(lonDeg: number): number {
  return ((((lonDeg + 180) % 360) + 360) % 360) - 180;
}

/** 经纬度 -> 月固系单位向量。 */
export function latLonToBody({ latDeg, lonDeg }: LatLon): THREE.Vector3 {
  const lat = latDeg * D2R;
  const lon = lonDeg * D2R;
  return new THREE.Vector3(Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat));
}

export function bodyToLatLon(v: THREE.Vector3): LatLon {
  const n = v.clone().normalize();
  return { latDeg: Math.asin(THREE.MathUtils.clamp(n.z, -1, 1)) * R2D, lonDeg: Math.atan2(n.y, n.x) * R2D };
}

export const bodyToThree = (v: THREE.Vector3) => new THREE.Vector3(v.x, v.z, -v.y);
export const threeToBody = (v: THREE.Vector3) => new THREE.Vector3(v.x, -v.z, v.y);

/**
 * 太阳在月固系里的单位方向。做法：取经纬 0/0 处的太阳方位角/高度角，
 * 那里"上"= x、"东"= y、"北"= z，直接拼回向量。观察点离月心 1737 km，相对日月距离可忽略（< 0.001°）。
 */
export function sunDirectionBody(timeMs: number): THREE.Vector3 {
  const { sun } = skyAtLatLon(timeMs, 0, 0);
  const az = sun.azimuthDeg * D2R;
  const el = sun.elevationDeg * D2R;
  return new THREE.Vector3(Math.sin(el), Math.sin(az) * Math.cos(el), Math.cos(az) * Math.cos(el)).normalize();
}

/** 地球在月固系里的单位方向（同样取经纬 0/0 处的方位角/高度角拼回向量；观察点偏离月心带来的误差约 0.26°）。 */
export function earthDirectionBody(timeMs: number): THREE.Vector3 {
  const { earth } = skyAtLatLon(timeMs, 0, 0);
  const az = earth.azimuthDeg * D2R;
  const el = earth.elevationDeg * D2R;
  return new THREE.Vector3(Math.sin(el), Math.sin(az) * Math.cos(el), Math.cos(az) * Math.cos(el)).normalize();
}

/** 本地水平坐标系（three 用）：x = 东，y = 上，z = 南。方位角正北 0° 向东增加。 */
export function azElToLocal(azimuthDeg: number, elevationDeg: number): THREE.Vector3 {
  const az = azimuthDeg * D2R;
  const el = elevationDeg * D2R;
  return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
}

/** 某点的本地东、北、上三个方向（月固系）。 */
export function localBasis({ latDeg, lonDeg }: LatLon) {
  const lat = latDeg * D2R;
  const lon = lonDeg * D2R;
  return {
    up: new THREE.Vector3(Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)),
    east: new THREE.Vector3(-Math.sin(lon), Math.cos(lon), 0),
    north: new THREE.Vector3(-Math.sin(lat) * Math.cos(lon), -Math.sin(lat) * Math.sin(lon), Math.cos(lat)),
  };
}

const MOON_RADIUS_KM = 1737.4;

/** 两点间的大圆（球面最短）距离，按 1737.4 km 的参考球算，不含地形起伏。 */
export function greatCircleDistanceKm(a: LatLon, b: LatLon): number {
  const cosAngle = THREE.MathUtils.clamp(latLonToBody(a).dot(latLonToBody(b)), -1, 1);
  return Math.acos(cosAngle) * MOON_RADIUS_KM;
}

/** 沿大圆从 a 到 b 均匀取 segments+1 个点（含两端）。 */
export function greatCirclePath(a: LatLon, b: LatLon, segments: number): LatLon[] {
  const va = latLonToBody(a);
  const vb = latLonToBody(b);
  const angle = Math.acos(THREE.MathUtils.clamp(va.dot(vb), -1, 1));
  if (angle < 1e-9) return [a, b];
  const points: LatLon[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const v = va.clone().multiplyScalar(Math.sin((1 - t) * angle)).addScaledVector(vb, Math.sin(t * angle));
    points.push(bodyToLatLon(v));
  }
  return points;
}

export function formatLatLon({ latDeg, lonDeg }: LatLon): string {
  const lat = `${Math.abs(latDeg).toFixed(2)}°${latDeg >= 0 ? "N" : "S"}`;
  const lon = `${Math.abs(lonDeg).toFixed(2)}°${lonDeg >= 0 ? "E" : "W"}`;
  return `${lat}  ${lon}`;
}
