import { z } from "zod";
import { getPointConditions } from "@/core/data";
import type { PointConditions } from "@/core/types";
import { MAX_COMPARE_POINTS, positionSchema, resolveTimeMs, timeUtcSchema } from "@/lib/shared/schemas";

export const comparePointsInputSchema = z.object({
  points: z
    .array(positionSchema)
    .min(1)
    .max(MAX_COMPARE_POINTS)
    .describe(`1 to ${MAX_COMPARE_POINTS} points to compare side by side`),
  time: timeUtcSchema,
});

export type ComparePointsInput = z.output<typeof comparePointsInputSchema>;

export interface ComparePointsResult {
  /** 所有点共用的查询时刻（UTC）。 */
  timeUtc: string;
  /** 与输入顺序一致。 */
  results: PointConditions[];
}

export function comparePoints(input: ComparePointsInput): ComparePointsResult {
  const timeMs = resolveTimeMs(input.time);
  return {
    timeUtc: new Date(timeMs).toISOString(),
    results: input.points.map((point) => getPointConditions(point, timeMs)),
  };
}
