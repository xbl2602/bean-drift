// 还没接入数据的参数组：地形、地形遮挡后的可见性、一年统计。
// 接口形状已定（见 docs/SHARED_INTERFACES.md 第 2 节），但没有数据，所以每个字段都是 null，并带"还没接入"的说明。
// 这里不编造任何数。接入真实数据时：在 point-conditions.ts 里用真实值换掉对应的 emptyXxx() 调用，
// 并把对应 Provenance 的 status 改成 "ok"（来源、分辨率写进 source / note）。调用方不用改。
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
  return { visibleFraction: null, longestOutageH: null, visibleWindows: null };
}

export function emptyYearStats(): YearStats {
  return { periodStartUtc: null, periodEndUtc: null, sun: emptyBodyYearStats(), earth: emptyBodyYearStats() };
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
