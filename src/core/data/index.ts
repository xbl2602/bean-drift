// 统一数据接口的唯一出口。logic/ 只能从这里拿数据。
export { canonicalLonDeg, getPointConditions, normalizeLonDeg } from "./point-conditions";
export { getPointAcrossTimes, POINT_ACROSS_TIMES_PROVENANCE } from "./point-snapshots";
export type { PointAcrossTimes } from "./point-snapshots";
export { getPointTimeline, MAX_TIMELINE_HOURS, MAX_TIMELINE_SAMPLES, MIN_TIMELINE_STEP_MIN } from "./point-timeline";
export type { PointTimeline } from "./point-timeline";
export { listPresets } from "./presets";
export { getSolarEnergyEstimate, MAX_ENERGY_HOURS, SOLAR_CONSTANT_W_PER_M2 } from "./solar-energy";
export type { SolarEnergyEstimate, SurfaceEnergy } from "./solar-energy";
export { findSites } from "./site-search";
export type { FindSitesResult } from "./site-search";
