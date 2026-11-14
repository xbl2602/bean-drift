// 统一数据接口：给定月面位置和时间，返回点位参数。
// 目前真实可用的只有"太阳/地球方位角与高度角"（星历）。地形和一年统计需要 pipeline 产出的衍生数据，
// 还没接入，所以这里如实返回 null + 说明，而不是编一个数。接入后只改本文件，调用方不用动。
import { skyAtLatLon } from "../ephemeris/ephemeris";
import type { LunarPosition, PointConditions } from "../types";

/** 把经度规范到 [-180, 180]。 */
export function normalizeLonDeg(lonDeg: number): number {
  return ((((lonDeg + 180) % 360) + 360) % 360) - 180;
}

export function getPointConditions(position: LunarPosition, timeMs: number): PointConditions {
  // 规范化会带来 1e-14 量级的浮点噪声（23.47314 -> 23.473140000000058），取 6 位小数（约 0.03 m）去掉
  const lonDeg = Number(normalizeLonDeg(position.lonDeg).toFixed(6));
  const sky = skyAtLatLon(timeMs, position.latDeg, lonDeg);
  const round = (value: number, digits: number) => Number(value.toFixed(digits));

  return {
    position: { latDeg: position.latDeg, lonDeg },
    timeUtc: new Date(timeMs).toISOString(),
    sun: {
      azimuthDeg: round(sky.sun.azimuthDeg, 3),
      elevationDeg: round(sky.sun.elevationDeg, 3),
      aboveSphericalHorizon: sky.sun.elevationDeg > 0,
    },
    earth: {
      azimuthDeg: round(sky.earth.azimuthDeg, 3),
      elevationDeg: round(sky.earth.elevationDeg, 3),
      aboveSphericalHorizon: sky.earth.elevationDeg > 0,
      distanceKm: round(sky.earth.distanceKm, 1),
      angularRadiusDeg: round(sky.earth.angularRadiusDeg, 4),
      illuminatedFraction: round(sky.earth.illuminatedFraction, 4),
    },
    terrain: null,
    yearStats: null,
    provenance: {
      ephemeris: {
        status: "ok",
        source: "Truncated Meeus lunar theory + low-precision Sun + IAU lunar orientation (WGCCRE 2009); checked against JPL Horizons",
        note: "Accuracy about 0.02 degrees; fine for visualising illumination and comms windows, not for mission-grade planning. Angles are relative to a smooth 1737.4 km sphere (no terrain).",
      },
      terrain: {
        status: "unavailable",
        source: "NASA LOLA (planned)",
        note: "Terrain-derived values (height, slope, horizon profile, terrain occlusion) are not wired in yet. They need pipeline-derived data (see docs/DATA_FLOW.md).",
      },
      yearStats: {
        status: "unavailable",
        source: "pipeline (planned)",
        note: "Year statistics are waiting on the metric definitions (docs/TODO.md Q1).",
      },
    },
    conventions: {
      longitude: "selenographic degrees, east positive, normalized to [-180, 180]",
      azimuth: "compass bearing in degrees: north = 0, increasing toward east",
      elevation: "degrees above the local horizontal of a smooth sphere; 90 = zenith",
      time: "UTC, ISO 8601",
      moonReferenceRadiusKm: 1737.4,
    },
  };
}
