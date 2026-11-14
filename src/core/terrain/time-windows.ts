// 时间段的纯计算：找"可见"的连续时间段、两组时间段求交、统计占比和最长空档。
// 没有任何 import，不依赖 Node、HTTP、文件；"此刻可见吗"由调用方传进来（星历和地形都在调用方那边）。

/** 一段连续时间，毫秒时间戳，起点含、终点不含。 */
export interface Interval {
  startMs: number;
  endMs: number;
}

const BISECTION_ROUNDS = 8; // 10 分钟的扫描步长二分 8 次 ≈ 2 秒

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

/**
 * 在 [startMs, endMs] 里找所有"可见"的连续时间段。
 * 每隔 scanStepMs 取一次样，发现状态变化就二分到约 2 秒；被范围首尾截断的时段按截断后的算。
 * 局限：短于 scanStepMs 的时段（取样之间升起又落下）会漏掉。
 */
export function findVisibleIntervals(
  isVisibleAt: (timeMs: number) => boolean,
  startMs: number,
  endMs: number,
  scanStepMs: number,
): Interval[] {
  const intervals: Interval[] = [];
  let previous = isVisibleAt(startMs);
  let previousMs = startMs;
  let openStartMs: number | null = previous ? startMs : null;
  const steps = Math.ceil((endMs - startMs) / scanStepMs);
  for (let step = 1; step <= steps; step++) {
    const t = Math.min(endMs, startMs + step * scanStepMs);
    const visible = isVisibleAt(t);
    if (visible !== previous) {
      const transitionMs = refineTransition(isVisibleAt, previousMs, t, visible);
      if (visible) {
        openStartMs = transitionMs;
      } else if (openStartMs !== null) {
        intervals.push({ startMs: openStartMs, endMs: transitionMs });
        openStartMs = null;
      }
    }
    previous = visible;
    previousMs = t;
  }
  if (openStartMs !== null && endMs > openStartMs) intervals.push({ startMs: openStartMs, endMs });
  return intervals;
}

/** 两组时间段的交集（"两个同时可见"）。两组都要按时间排好序、各自内部不重叠。 */
export function intersectIntervals(a: readonly Interval[], b: readonly Interval[]): Interval[] {
  const result: Interval[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const startMs = Math.max(a[i].startMs, b[j].startMs);
    const endMs = Math.min(a[i].endMs, b[j].endMs);
    if (endMs > startMs) result.push({ startMs, endMs });
    if (a[i].endMs < b[j].endMs) i++;
    else j++;
  }
  return result;
}

export interface IntervalSummary {
  /** 范围内可见的时间占比，0~1。 */
  visibleFraction: number;
  /** 范围内最长一次连续不可见，毫秒（从未可见 = 整个范围）。 */
  longestGapMs: number;
}

/** 把一组可见时段（排好序、不重叠）放回 [startMs, endMs] 里，算可见占比和最长空档。 */
export function summarizeIntervals(intervals: readonly Interval[], startMs: number, endMs: number): IntervalSummary {
  const total = endMs - startMs;
  let visibleMs = 0;
  let longestGapMs = 0;
  let cursor = startMs;
  for (const interval of intervals) {
    longestGapMs = Math.max(longestGapMs, interval.startMs - cursor);
    visibleMs += interval.endMs - interval.startMs;
    cursor = interval.endMs;
  }
  longestGapMs = Math.max(longestGapMs, endMs - cursor);
  return { visibleFraction: total <= 0 ? 0 : visibleMs / total, longestGapMs };
}
