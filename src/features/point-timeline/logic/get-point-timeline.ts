// 纯业务函数：一个点、一段时间里太阳和地球怎么变，以及什么时候有光、什么时候能对地通信。
import { z } from "zod";
import { getPointTimeline, MAX_TIMELINE_HOURS, MAX_TIMELINE_SAMPLES, MIN_TIMELINE_STEP_MIN } from "@/core/data";
import type { PointTimeline } from "@/core/data";
import { latDegSchema, lonDegSchema, minEarthElevationDegSchema, resolveTimeMs, timeUtcSchema } from "@/lib/shared/schemas";

/** 不指定间隔时，曲线大约取这么多个点。 */
const TARGET_SAMPLES = 144;

export const pointTimelineInputSchema = z
  .object({
    latDeg: latDegSchema,
    lonDeg: lonDegSchema,
    time: timeUtcSchema.describe("Start of the period, UTC ISO 8601 with a trailing Z. Defaults to now. Valid 2000-2100."),
    durationH: z
      .number()
      .min(1)
      .max(MAX_TIMELINE_HOURS)
      .default(720)
      .describe(`Length of the period in hours, 1 to ${MAX_TIMELINE_HOURS} (a lunar day is about 708 hours). Default 720.`),
    stepMin: z
      .number()
      .int()
      .min(MIN_TIMELINE_STEP_MIN)
      .max(1440)
      .optional()
      .describe(
        `Spacing of the curve samples in minutes (${MIN_TIMELINE_STEP_MIN} to 1440), at most ${MAX_TIMELINE_SAMPLES} samples in total. Omit to get about ${TARGET_SAMPLES} samples. The visibility windows are computed separately and do not depend on this.`,
      ),
    minEarthElevationDeg: minEarthElevationDegSchema,
  })
  .refine((input) => input.stepMin === undefined || Math.floor((input.durationH * 60) / input.stepMin) + 1 <= MAX_TIMELINE_SAMPLES, {
    path: ["stepMin"],
    message: `stepMin is too small for durationH: at most ${MAX_TIMELINE_SAMPLES} samples are returned. Use a larger stepMin or a shorter durationH.`,
  });

export type PointTimelineInput = z.output<typeof pointTimelineInputSchema>;

/** 没指定采样间隔时：取 10 分钟的整数倍，让点数不超过 TARGET_SAMPLES。 */
function defaultStepMin(durationH: number): number {
  return Math.max(MIN_TIMELINE_STEP_MIN, Math.ceil((durationH * 60) / (TARGET_SAMPLES - 1) / 10) * 10);
}

export function getPointTimelineForQuery(input: PointTimelineInput): PointTimeline {
  return getPointTimeline(
    { latDeg: input.latDeg, lonDeg: input.lonDeg },
    resolveTimeMs(input.time),
    input.durationH,
    input.stepMin ?? defaultStepMin(input.durationH),
    { minEarthElevationDeg: input.minEarthElevationDeg },
  );
}
