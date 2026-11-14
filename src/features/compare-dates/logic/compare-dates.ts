// 纯业务函数：同一批点在几个不同日期的对比（和 compare-points 互补：那个是多个点、同一时刻）。
import { z } from "zod";
import { getPointAcrossTimes, POINT_ACROSS_TIMES_PROVENANCE } from "@/core/data";
import type { PointAcrossTimes } from "@/core/data";
import type { Provenance } from "@/core/types";
import {
  MAX_COMPARE_DATES_POINTS,
  MAX_COMPARE_DATES_TIMES,
  minEarthElevationDegSchema,
  positionSchema,
  requiredTimeUtcSchema,
} from "@/lib/shared/schemas";

export const compareDatesInputSchema = z.object({
  points: z.array(positionSchema).min(1).max(MAX_COMPARE_DATES_POINTS).describe(`1 to ${MAX_COMPARE_DATES_POINTS} points`),
  times: z
    .array(requiredTimeUtcSchema)
    .min(1)
    .max(MAX_COMPARE_DATES_TIMES)
    .describe(`1 to ${MAX_COMPARE_DATES_TIMES} moments (UTC) to compare, e.g. different seasons or lunar days`),
  minEarthElevationDeg: minEarthElevationDegSchema,
});

export type CompareDatesInput = z.output<typeof compareDatesInputSchema>;

export interface CompareDatesResult {
  /** 与输入顺序一致。 */
  timesUtc: string[];
  /** 与输入顺序一致；每个点里的 snapshots 与 timesUtc 一一对应。 */
  points: PointAcrossTimes[];
  provenance: Provenance;
}

export function compareDates(input: CompareDatesInput): CompareDatesResult {
  const timesMs = input.times.map((time) => Date.parse(time));
  return {
    timesUtc: timesMs.map((ms) => new Date(ms).toISOString()),
    points: input.points.map((point) => getPointAcrossTimes(point, timesMs, { minEarthElevationDeg: input.minEarthElevationDeg })),
    provenance: POINT_ACROSS_TIMES_PROVENANCE,
  };
}
