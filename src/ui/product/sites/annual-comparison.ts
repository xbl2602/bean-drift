import type { PointTimeline } from "@/core/data/point-timeline";
import type { PointConditions } from "@/core/types";

export type ComparisonTimeline = Pick<PointTimeline, "position" | "startUtc" | "endUtc" | "durationH" | "assumptions" | "sun" | "earth" | "provenance"> & { both: Pick<PointTimeline["both"], "visibleFraction"> };

/** Present the API's actual precomputed year, never a rolling-year approximation. */
export function annualComparison(data: PointConditions): ComparisonTimeline {
  const stats = data.yearStats;
  const startUtc = stats.periodStartUtc, endUtc = stats.periodEndUtc;
  if (data.provenance.yearStats.status !== "ok" || !startUtc || !endUtc || stats.bothVisibleFraction === null) throw new Error("Annual data unavailable");
  const durationH = (Date.parse(endUtc) - Date.parse(startUtc)) / 3_600_000;
  if (!Number.isFinite(durationH) || durationH <= 0) throw new Error("Invalid annual period");
  const body = (value: typeof stats.sun) => {
    if (value.visibleFraction === null || value.longestOutageH === null || value.visibleWindows === null) throw new Error("Annual visibility unavailable");
    return { visibleFraction: value.visibleFraction, longestOutageH: value.longestOutageH, windows: value.visibleWindows };
  };
  return {position:data.position,startUtc,endUtc,durationH,assumptions:data.assumptions,sun:body(stats.sun),earth:body(stats.earth),both:{visibleFraction:stats.bothVisibleFraction,},provenance:data.provenance.yearStats};
}
