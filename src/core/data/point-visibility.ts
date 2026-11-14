// 单点的"地形遮挡后的可见性"和"一年统计"：用星历 + 这个点的地平线剖面现算（不是查表）。
// 整月地图（L4~L7）由 pipeline 预计算，口径与这里完全一致（上缘露出即可见），只是以 0.25° 格子中心为代表点。
import { skyAtLatLon } from "../ephemeris/ephemeris";
import { diskVisibleFraction, effectiveHorizonDeg, horizonElevationDeg, isDiskVisible, summarizeVisibilityRuns } from "../terrain/visibility";
import type { BodyVisibility, BodyYearStats, TimeWindow, Visibility, YearStats } from "../types";

const HOUR_MS = 3_600_000;
/** 一年统计的统计期：2030-01-01 起 8760 小时，逐小时取样（TODO Q1 的决定）。 */
export const YEAR_STATS_START_MS = Date.UTC(2030, 0, 1);
export const YEAR_STATS_HOURS = 8760;
/** 找"下一次升起/落下"：最多往后找 60 天（够覆盖一个朔望月和地球的天平动周期），每 10 分钟取一次样。 */
const SEARCH_DAYS = 60;
const SEARCH_STEP_MS = 10 * 60_000;
const BISECTION_ROUNDS = 8; // 10 分钟 / 2^8 ≈ 2 秒

export interface BodiesSky {
  sun: { azimuthDeg: number; elevationDeg: number; angularRadiusDeg: number };
  earth: { azimuthDeg: number; elevationDeg: number; angularRadiusDeg: number };
}

/**
 * 已知此刻太阳和地球在天上的位置，判断它们相对该点地平线剖面是否可见（圆盘上缘高于地平线）。
 * minEarthElevationDeg：地球还要高过多少度才算可见（只影响地球）；不传 = 只看地形。
 * "可见"的规则只在这里定义一次：时间序列、单点查询、一年统计都走这里。
 */
export function visibleFromSky(profileDeg: number[], sky: BodiesSky, minEarthElevationDeg?: number): { sun: boolean; earth: boolean } {
  return {
    sun: isDiskVisible(sky.sun.elevationDeg, sky.sun.angularRadiusDeg, horizonElevationDeg(profileDeg, sky.sun.azimuthDeg)),
    earth: isDiskVisible(
      sky.earth.elevationDeg,
      sky.earth.angularRadiusDeg,
      effectiveHorizonDeg(horizonElevationDeg(profileDeg, sky.earth.azimuthDeg), minEarthElevationDeg),
    ),
  };
}

/** 某一时刻，太阳和地球相对该点地平线剖面的状态。 */
export function bodiesVisibleAt(
  profileDeg: number[],
  latDeg: number,
  lonDeg: number,
  timeMs: number,
  minEarthElevationDeg?: number,
): { sun: boolean; earth: boolean } {
  return visibleFromSky(profileDeg, skyAtLatLon(timeMs, latDeg, lonDeg), minEarthElevationDeg);
}

function bodyVisibilityNow(profileDeg: number[], body: BodiesSky["sun"], minElevationDeg?: number): { fraction: number; visible: boolean } {
  const horizon = effectiveHorizonDeg(horizonElevationDeg(profileDeg, body.azimuthDeg), minElevationDeg);
  return {
    fraction: diskVisibleFraction(body.elevationDeg, body.angularRadiusDeg, horizon),
    visible: isDiskVisible(body.elevationDeg, body.angularRadiusDeg, horizon),
  };
}

/** 在 (loMs, hiMs] 之间，状态由 !state 变成 state 的时刻（二分到约 2 秒）。 */
function refineTransition(isVisibleAt: (timeMs: number) => boolean, loMs: number, hiMs: number, state: boolean): number {
  let lo = loMs;
  let hi = hiMs;
  for (let round = 0; round < BISECTION_ROUNDS; round++) {
    const mid = (lo + hi) / 2;
    if (isVisibleAt(mid) === state) hi = mid;
    else lo = mid;
  }
  return hi;
}

/** 此刻起往后，下一次"由不可见变可见"和"由可见变不可见"的时刻；找不到为 null。 */
function nextRiseAndSet(isVisibleAt: (timeMs: number) => boolean, nowMs: number, visibleNow: boolean): { riseMs: number | null; setMs: number | null } {
  let riseMs: number | null = null;
  let setMs: number | null = null;
  let previous = visibleNow;
  let previousMs = nowMs;
  const steps = Math.round((SEARCH_DAYS * 24 * HOUR_MS) / SEARCH_STEP_MS);
  for (let step = 1; step <= steps && (riseMs === null || setMs === null); step++) {
    const t = nowMs + step * SEARCH_STEP_MS;
    const visible = isVisibleAt(t);
    if (visible !== previous) {
      const transitionMs = refineTransition(isVisibleAt, previousMs, t, visible);
      if (visible && riseMs === null) riseMs = transitionMs;
      if (!visible && setMs === null) setMs = transitionMs;
    }
    previous = visible;
    previousMs = t;
  }
  return { riseMs, setMs };
}

const toIso = (ms: number | null) => (ms === null ? null : new Date(ms).toISOString());

/** 此刻太阳和地球的可见比例，以及下一次升起/落下。profileDeg 是该点的地平线剖面。 */
export function computeVisibility(
  profileDeg: number[],
  latDeg: number,
  lonDeg: number,
  timeMs: number,
  sky: BodiesSky,
  minEarthElevationDeg?: number,
): Visibility {
  const build = (body: BodiesSky["sun"], pick: "sun" | "earth"): BodyVisibility => {
    const floorDeg = pick === "earth" ? minEarthElevationDeg : undefined;
    const now = bodyVisibilityNow(profileDeg, body, floorDeg);
    const { riseMs, setMs } = nextRiseAndSet((t) => bodiesVisibleAt(profileDeg, latDeg, lonDeg, t, minEarthElevationDeg)[pick], timeMs, now.visible);
    return { diskVisibleFraction: Number(now.fraction.toFixed(4)), nextRiseUtc: toIso(riseMs), nextSetUtc: toIso(setMs) };
  };
  return { sun: build(sky.sun, "sun"), earth: build(sky.earth, "earth") };
}

/** 一年统计：逐小时取样 YEAR_STATS_HOURS 步，统计太阳（断电）和地球（断信号）。 */
export function computeYearStats(profileDeg: number[], latDeg: number, lonDeg: number, minEarthElevationDeg?: number): YearStats {
  const sun = new Uint8Array(YEAR_STATS_HOURS);
  const earth = new Uint8Array(YEAR_STATS_HOURS);
  let bothHours = 0;
  for (let hour = 0; hour < YEAR_STATS_HOURS; hour++) {
    const visible = bodiesVisibleAt(profileDeg, latDeg, lonDeg, YEAR_STATS_START_MS + hour * HOUR_MS, minEarthElevationDeg);
    sun[hour] = visible.sun ? 1 : 0;
    earth[hour] = visible.earth ? 1 : 0;
    if (visible.sun && visible.earth) bothHours += 1;
  }
  const summarize = (flags: Uint8Array): BodyYearStats => {
    const runs = summarizeVisibilityRuns(flags, 1);
    const windows: TimeWindow[] = runs.visibleWindows.map((w) => ({
      startUtc: new Date(YEAR_STATS_START_MS + w.startStep * HOUR_MS).toISOString(),
      endUtc: new Date(YEAR_STATS_START_MS + w.endStep * HOUR_MS).toISOString(),
      durationH: w.endStep - w.startStep,
    }));
    return {
      visibleFraction: Number(runs.visibleFraction.toFixed(4)),
      longestOutageH: runs.longestOutageH,
      meanOutageH: Number(runs.meanOutageH.toFixed(2)),
      meanVisibleWindowH: Number(runs.meanVisibleWindowH.toFixed(2)),
      visibleWindows: windows,
    };
  };
  return {
    periodStartUtc: new Date(YEAR_STATS_START_MS).toISOString(),
    periodEndUtc: new Date(YEAR_STATS_START_MS + YEAR_STATS_HOURS * HOUR_MS).toISOString(),
    sun: summarize(sun),
    earth: summarize(earth),
    bothVisibleFraction: Number((bothHours / YEAR_STATS_HOURS).toFixed(4)),
  };
}
