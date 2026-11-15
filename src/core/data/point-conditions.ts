// 统一数据接口：给定月面位置和时间，返回点位参数。
// 太阳/地球的方位角、高度角、距离、视半径来自星历；地形、遮挡后的可见性、一年统计来自 pipeline 预计算的
// 整月地图（public/data/v1/）加现算，拼装见 terrain-groups.ts。读不到预计算数据时，这三组降级成字段全为 null
// + 说明（见 unavailable-parameters.ts），而不是编一个数，也不让整个接口出错。
import { skyAtLatLon } from "../ephemeris/ephemeris";
import type { LunarPosition, PointConditions, PointQueryOptions } from "../types";
import { buildTerrainGroups } from "./terrain-groups";

/** 把经度规范到 [-180, 180]。 */
export function normalizeLonDeg(lonDeg: number): number {
  return ((((lonDeg + 180) % 360) + 360) % 360) - 180;
}

/**
 * 对外统一的经度写法：规范到 [-180, 180]。
 * 规范化会带来 1e-14 量级的浮点噪声（23.47314 -> 23.473140000000058），取 6 位小数（约 0.03 m）去掉。
 */
export function canonicalLonDeg(lonDeg: number): number {
  return Number(normalizeLonDeg(lonDeg).toFixed(6));
}

export function getPointConditions(position: LunarPosition, timeMs: number, options: PointQueryOptions = {}): PointConditions {
  const lonDeg = canonicalLonDeg(position.lonDeg);
  const sky = skyAtLatLon(timeMs, position.latDeg, lonDeg);
  const round = (value: number, digits: number) => Number(value.toFixed(digits));
  const terrainGroups = buildTerrainGroups(position.latDeg, lonDeg, timeMs, sky, options);

  return {
    position: { latDeg: position.latDeg, lonDeg },
    timeUtc: new Date(timeMs).toISOString(),
    sun: {
      azimuthDeg: round(sky.sun.azimuthDeg, 3),
      elevationDeg: round(sky.sun.elevationDeg, 3),
      aboveSphericalHorizon: sky.sun.elevationDeg > 0,
      // 太阳用低精度模型，最后几位没有意义，取整到 1000 km
      distanceKm: Math.round(sky.sun.distanceKm / 1000) * 1000,
      angularRadiusDeg: round(sky.sun.angularRadiusDeg, 4),
    },
    earth: {
      azimuthDeg: round(sky.earth.azimuthDeg, 3),
      elevationDeg: round(sky.earth.elevationDeg, 3),
      aboveSphericalHorizon: sky.earth.elevationDeg > 0,
      distanceKm: round(sky.earth.distanceKm, 1),
      angularRadiusDeg: round(sky.earth.angularRadiusDeg, 4),
      illuminatedFraction: round(sky.earth.illuminatedFraction, 4),
    },
    terrain: terrainGroups.terrain,
    visibility: terrainGroups.visibility,
    yearStats: terrainGroups.yearStats,
    provenance: {
      ephemeris: {
        status: "ok",
        source: "Truncated Meeus lunar theory + low-precision Sun + IAU lunar orientation (WGCCRE 2009); checked against JPL Horizons",
        note: "Accuracy about 0.02 degrees; fine for visualising illumination and comms windows, not for mission-grade planning. Angles are relative to a smooth 1737.4 km sphere (no terrain).",
      },
      terrain: terrainGroups.provenance.terrain,
      visibility: terrainGroups.provenance.visibility,
      yearStats: terrainGroups.provenance.yearStats,
    },
    assumptions: { minEarthElevationDeg: options.minEarthElevationDeg ?? null },
    conventions: {
      longitude: "selenographic degrees, east positive, normalized to [-180, 180]",
      azimuth: "compass bearing in degrees: north = 0, increasing toward east",
      elevation: "degrees above the local horizontal of a smooth sphere; 90 = zenith",
      time: "UTC, ISO 8601",
      height: "meters above the 1737.4 km reference sphere",
      duration: "hours",
      fraction: "ratio from 0 to 1",
      moonReferenceRadiusKm: 1737.4,
    },
  };
}
