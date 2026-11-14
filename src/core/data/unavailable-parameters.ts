// 地形、地形遮挡后的可见性、一年统计这三组参数的"没有数据"版本：每个字段都是 null，并带说明。
// 真实数据由 terrain-groups.ts 拼装；只有预计算数据文件读不到时才会退回这里（降级），接口仍然返回，
// 而不是整体报错。这里不编造任何数。
//
// 用函数而不是常量：每次返回新对象，避免多个请求共用同一个对象（服务端不放可变的模块级状态）。
import type { BodyVisibility, BodyYearStats, Provenance, TerrainParameters, Visibility, YearStats } from "../types";

export function emptyTerrain(): TerrainParameters {
  return { heightM: null, slopeDeg: null, aspectDeg: null, horizonProfile: null, resolutionM: null };
}

function emptyBodyVisibility(): BodyVisibility {
  return { diskVisibleFraction: null, nextRiseUtc: null, nextSetUtc: null };
}

export function emptyVisibility(): Visibility {
  return { sun: emptyBodyVisibility(), earth: emptyBodyVisibility() };
}

function emptyBodyYearStats(): BodyYearStats {
  return { visibleFraction: null, longestOutageH: null, meanOutageH: null, meanVisibleWindowH: null, visibleWindows: null };
}

export function emptyYearStats(): YearStats {
  return { periodStartUtc: null, periodEndUtc: null, sun: emptyBodyYearStats(), earth: emptyBodyYearStats(), bothVisibleFraction: null };
}

export function unavailableTerrainProvenance(): Provenance {
  return {
    status: "unavailable",
    source: "NASA LOLA (planned)",
    note: "Terrain values (height, slope, aspect, horizon profile) are not wired in yet. They need pipeline-derived data (see docs/DATA_FLOW.md). All fields are null.",
  };
}

export function unavailableVisibilityProvenance(): Provenance {
  return {
    status: "unavailable",
    source: "ephemeris + terrain horizon profile (planned)",
    note: "Terrain-aware visibility needs the horizon profile, which is not wired in yet. For a smooth-sphere answer use sun/earth.aboveSphericalHorizon. All fields are null.",
  };
}

export function unavailableYearStatsProvenance(): Provenance {
  return {
    status: "unavailable",
    source: "pipeline (planned)",
    note: "Year statistics are waiting on the metric definitions (docs/TODO.md Q1) and on terrain data. All fields are null.",
  };
}
