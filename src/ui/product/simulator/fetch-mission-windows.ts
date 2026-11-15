"use client";
// 取任务期间太阳、地球什么时候"看得见"（考虑真实地形遮挡）：调本站 /api/timeline（和 API、MCP、AI 窗口同一份数据）。
// 接口一次最多 744 小时（31 天），更长的任务就按月切开取，最多同时 3 个请求；每一段失败都会让整个模拟报错（不拿残缺数据算）。
import type { PointTimeline } from "@/core/data/point-timeline";
import type { LatLon } from "../moon-frames";

const HOUR_MS = 3_600_000;
const CHUNK_H = 744;
const PARALLEL = 3;

export interface Interval { startMs: number; endMs: number }

export interface MissionWindows {
  sun: Interval[];
  earth: Interval[];
  /** 数据来源说明（原样来自接口）。 */
  source: string;
}

export class MissionDataError extends Error {}

async function fetchChunk(point: LatLon, startMs: number, hours: number, minEarthElevationDeg: number | null, signal: AbortSignal): Promise<PointTimeline> {
  const params = new URLSearchParams({
    latDeg: point.latDeg.toFixed(4),
    lonDeg: point.lonDeg.toFixed(4),
    time: new Date(startMs).toISOString(),
    durationH: String(hours),
    // 只要可见时间段，不要曲线：每天一个点就够，返回最小
    stepMin: "1440",
  });
  if (minEarthElevationDeg !== null) params.set("minEarthElevationDeg", String(minEarthElevationDeg));
  let response: Response;
  try {
    response = await fetch(`/api/timeline?${params}`, { signal });
  } catch (cause) {
    if (signal.aborted) throw cause;
    throw new MissionDataError("Could not reach the Lunar Quest data service. Check your connection and try again.");
  }
  if (!response.ok) {
    throw new MissionDataError(response.status === 400 ? "This place or date is outside what the data covers (years 2000–2100)." : "The sunlight and Earth-contact data could not be calculated right now. Try again in a moment.");
  }
  return (await response.json()) as PointTimeline;
}

const toIntervals = (windows: PointTimeline["sun"]["windows"]): Interval[] => windows.map((w) => ({ startMs: Date.parse(w.startUtc), endMs: Date.parse(w.endUtc) }));

/** 相邻两段在接缝处各自截断的窗口拼回一个。 */
function mergeTouching(intervals: Interval[]): Interval[] {
  const sorted = [...intervals].sort((a, b) => a.startMs - b.startMs);
  const merged: Interval[] = [];
  for (const interval of sorted) {
    const last = merged[merged.length - 1];
    if (last && interval.startMs <= last.endMs + 60_000) last.endMs = Math.max(last.endMs, interval.endMs);
    else merged.push({ ...interval });
  }
  return merged;
}

/** onProgress(已完成段数, 总段数)。 */
export async function fetchMissionWindows(point: LatLon, startMs: number, durationDays: number, minEarthElevationDeg: number | null, signal: AbortSignal, onProgress: (done: number, total: number) => void): Promise<MissionWindows> {
  const totalH = Math.round(durationDays * 24);
  const chunks: Array<{ startMs: number; hours: number }> = [];
  for (let offsetH = 0; offsetH < totalH; offsetH += CHUNK_H) chunks.push({ startMs: startMs + offsetH * HOUR_MS, hours: Math.min(CHUNK_H, totalH - offsetH) });
  const results: PointTimeline[] = new Array(chunks.length);
  let next = 0;
  let done = 0;
  onProgress(0, chunks.length);
  const worker = async () => {
    while (next < chunks.length) {
      const index = next++;
      results[index] = await fetchChunk(point, chunks[index].startMs, chunks[index].hours, minEarthElevationDeg, signal);
      onProgress(++done, chunks.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL, chunks.length) }, worker));
  return {
    sun: mergeTouching(results.flatMap((r) => toIntervals(r.sun.windows))),
    earth: mergeTouching(results.flatMap((r) => toIntervals(r.earth.windows))),
    source: results[0]?.provenance.source ?? "",
  };
}
