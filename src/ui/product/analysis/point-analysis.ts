// 一个点、一个时间的完整分析：实测量（高度、坡度）、星历量（太阳/地球角度，来自 src/core）、模型量（analysis-model.ts）。
// 悬停读数、候选点卡片、对比表、导出都用这一个函数，保证各处数字一致。
import { sampleGround } from "../first-person/height-tiles";
import type { SuitabilityWeights } from "../map-layers";
import { localBasis, type LatLon } from "../moon-frames";
import { skyConditionsAt } from "../sky-conditions";
import { computeSiteMetrics, type SiteMetrics, type Vec3 } from "./analysis-model";
import { samplePolarLight } from "./polar-light";
import { monthSunSamples, sunBodyAt } from "./sun-samples";

export interface PointAnalysis extends SiteMetrics {
  latDeg: number;
  lonDeg: number;
  timeUtc: string;
  /** 实测：LOLA 高度，相对 1737.4 km 参考球。 */
  heightM: number;
  /** 星历：相对光滑球面地平线，不含地形遮挡。 */
  sunElevationDeg: number;
  sunAzimuthDeg: number;
  earthElevationDeg: number;
  earthAzimuthDeg: number;
}

export async function analyzePoint(point: LatLon, timeMs: number, weights: SuitabilityWeights): Promise<PointAnalysis> {
  const [ground, polar] = await Promise.all([sampleGround(point), samplePolarLight(point)]);
  const basis = localBasis(point);
  // 地形法线 = (-dh/d东, -dh/d北, 1) 归一化，再从本地坐标转到月固系
  const n = basis.east.clone().multiplyScalar(-ground.gradEast).addScaledVector(basis.north, -ground.gradNorth).add(basis.up).normalize();
  const up: Vec3 = [basis.up.x, basis.up.y, basis.up.z];
  const metrics = computeSiteMetrics({ latDeg: point.latDeg, up, normal: [n.x, n.y, n.z], slopeDeg: ground.slopeDeg, polar }, sunBodyAt(timeMs), monthSunSamples(timeMs), weights);
  const sky = skyConditionsAt(point, timeMs);
  return {
    ...metrics,
    latDeg: point.latDeg,
    lonDeg: point.lonDeg,
    timeUtc: sky.timeUtc,
    heightM: ground.heightM,
    sunElevationDeg: sky.sun.elevationDeg,
    sunAzimuthDeg: sky.sun.azimuthDeg,
    earthElevationDeg: sky.earth.elevationDeg,
    earthAzimuthDeg: sky.earth.azimuthDeg,
  };
}
