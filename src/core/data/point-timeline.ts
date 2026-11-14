// 单点的时间序列：一段时间里太阳、地球的方位角/高度角，以及各自"可见"的连续时间段（被地形遮挡之后）。
// 给"一个月昼里光照和通信怎么变"这类问题用（时间线、动画）。"可见"的规则和单点查询、一年统计完全一致，见 point-visibility.ts。
import { skyAtLatLon } from "../ephemeris/ephemeris";
import { findVisibleIntervals, intersectIntervals, summarizeIntervals, type Interval } from "../terrain/time-windows";
import type { LunarPosition, PointQueryOptions, Provenance, TimeWindow } from "../types";
import { canonicalLonDeg } from "./point-conditions";
import { bodiesVisibleAt, visibleFromSky } from "./point-visibility";
import { readPointHorizonProfile } from "./terrain-source-routing";

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
/** 找可见时间段时每隔多久取一次样；发现变化后二分到约 2 秒。 */
const SCAN_STEP_MS = 10 * MINUTE_MS;

/** 一次最长 31 天，够覆盖一个完整月昼（约 29.5 天）。 */
export const MAX_TIMELINE_HOURS = 744;
export const MIN_TIMELINE_STEP_MIN = 10;
/** 曲线采样点上限：太多的话单次返回会大到 AI 窗口放不下。 */
export const MAX_TIMELINE_SAMPLES = 240;

export interface TimelineBody {
  azimuthDeg: number;
  elevationDeg: number;
  /** 被地形遮挡之后，圆盘上缘是否高于地平线。 */
  visible: boolean;
}

export interface TimelineSample {
  timeUtc: string;
  sun: TimelineBody;
  earth: TimelineBody;
}

export interface TimelineSummary {
  /** 这段时间里可见的占比，0~1。 */
  visibleFraction: number;
  /** 这段时间里最长一次连续不可见，小时（从未可见 = 整段时间）。 */
  longestOutageH: number;
  /** 可见的连续时间段；被这段时间首尾截断的按截断后的算。 */
  windows: TimeWindow[];
}

export interface PointTimeline {
  position: LunarPosition;
  startUtc: string;
  endUtc: string;
  durationH: number;
  /** 曲线 samples 的间隔，分钟。 */
  sampleStepMin: number;
  assumptions: { minEarthElevationDeg: number | null };
  /** 太阳可见 = 有电；地球可见 = 能直连通信；both = 两者同时。 */
  sun: TimelineSummary;
  earth: TimelineSummary;
  both: TimelineSummary;
  samples: TimelineSample[];
  provenance: Provenance;
}

const round = (value: number, digits: number) => Number(value.toFixed(digits));
const toIso = (ms: number) => new Date(Math.round(ms / 1000) * 1000).toISOString();

function toWindows(intervals: readonly Interval[]): TimeWindow[] {
  return intervals.map((interval) => ({
    startUtc: toIso(interval.startMs),
    endUtc: toIso(interval.endMs),
    durationH: round((interval.endMs - interval.startMs) / HOUR_MS, 2),
  }));
}

function summarize(intervals: readonly Interval[], startMs: number, endMs: number): TimelineSummary {
  const { visibleFraction, longestGapMs } = summarizeIntervals(intervals, startMs, endMs);
  return { visibleFraction: round(visibleFraction, 4), longestOutageH: round(longestGapMs / HOUR_MS, 2), windows: toWindows(intervals) };
}

const TIMELINE_PROVENANCE: Provenance = {
  status: "ok",
  source: "Sun/Earth ephemeris + terrain horizon profile from NASA LRO LOLA LDEM_64 (0.25 degree map cells, public/data/v1/manifest.json)",
  note:
    "A disk counts as visible when its upper limb is above the terrain horizon at the azimuth of the disk centre (same rule as get_point_conditions). " +
    "Window start and end times are refined to about 2 seconds; a window shorter than 10 minutes (rising and setting between two checks) can be missed. " +
    "Sun and Earth positions are accurate to about 0.02 degrees, not mission-grade. Horizon is the map cell horizon (about 7.6 km cells), not the exact point.",
};

/**
 * 从 startMs 起、持续 durationH 小时的时间序列。
 * sampleStepMin 是曲线的采样间隔（分钟）；可见时间段另用 10 分钟步长扫描并精修，和采样间隔无关。
 * 读不到预计算地形数据时抛错。
 */
export function getPointTimeline(
  position: LunarPosition,
  startMs: number,
  durationH: number,
  sampleStepMin: number,
  options: PointQueryOptions = {},
): PointTimeline {
  const endMs = startMs + durationH * HOUR_MS;
  const sampleStepMs = sampleStepMin * MINUTE_MS;
  const sampleCount = Math.floor((endMs - startMs) / sampleStepMs) + 1;
  if (sampleCount > MAX_TIMELINE_SAMPLES) throw new RangeError(`timeline would have ${sampleCount} samples; the limit is ${MAX_TIMELINE_SAMPLES}`);

  const latDeg = position.latDeg;
  const lonDeg = canonicalLonDeg(position.lonDeg);
  const floorDeg = options.minEarthElevationDeg;
  const profileDeg = readPointHorizonProfile(latDeg, lonDeg);

  const sunIntervals = findVisibleIntervals((t) => bodiesVisibleAt(profileDeg, latDeg, lonDeg, t, floorDeg).sun, startMs, endMs, SCAN_STEP_MS);
  const earthIntervals = findVisibleIntervals((t) => bodiesVisibleAt(profileDeg, latDeg, lonDeg, t, floorDeg).earth, startMs, endMs, SCAN_STEP_MS);

  const samples: TimelineSample[] = [];
  for (let k = 0; k < sampleCount; k++) {
    const timeMs = startMs + k * sampleStepMs;
    const sky = skyAtLatLon(timeMs, latDeg, lonDeg);
    const visible = visibleFromSky(profileDeg, sky, floorDeg);
    samples.push({
      timeUtc: new Date(timeMs).toISOString(),
      sun: { azimuthDeg: round(sky.sun.azimuthDeg, 3), elevationDeg: round(sky.sun.elevationDeg, 3), visible: visible.sun },
      earth: { azimuthDeg: round(sky.earth.azimuthDeg, 3), elevationDeg: round(sky.earth.elevationDeg, 3), visible: visible.earth },
    });
  }

  return {
    position: { latDeg, lonDeg },
    startUtc: new Date(startMs).toISOString(),
    endUtc: new Date(endMs).toISOString(),
    durationH,
    sampleStepMin,
    assumptions: { minEarthElevationDeg: floorDeg ?? null },
    sun: summarize(sunIntervals, startMs, endMs),
    earth: summarize(earthIntervals, startMs, endMs),
    both: summarize(intersectIntervals(sunIntervals, earthIntervals), startMs, endMs),
    samples,
    provenance: TIMELINE_PROVENANCE,
  };
}
