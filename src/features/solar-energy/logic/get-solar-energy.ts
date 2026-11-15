// 纯业务函数：一个点、一段时间里能晒到多少太阳，最长黑夜要多少电池。网页、API、MCP、agent 都调用它。
import { z } from "zod";
import { getSolarEnergyEstimate, MAX_ENERGY_HOURS } from "@/core/data";
import type { SolarEnergyEstimate } from "@/core/data";
import { latDegSchema, lonDegSchema, resolveTimeMs, timeUtcSchema } from "@/lib/shared/schemas";

export const solarEnergyInputSchema = z.object({
  latDeg: latDegSchema,
  lonDeg: lonDegSchema,
  time: timeUtcSchema.describe("Start of the period, UTC ISO 8601 with a trailing Z. Defaults to now. Valid 2000-2100."),
  durationH: z
    .number()
    .min(1)
    .max(MAX_ENERGY_HOURS)
    .default(720)
    .describe(`Length of the period in hours, 1 to ${MAX_ENERGY_HOURS} (a lunar day is about 708 hours, a year 8760). Default 720.`),
});

export type SolarEnergyInput = z.output<typeof solarEnergyInputSchema>;

export function getSolarEnergyForQuery(input: SolarEnergyInput): SolarEnergyEstimate {
  return getSolarEnergyEstimate({ latDeg: input.latDeg, lonDeg: input.lonDeg }, resolveTimeMs(input.time), input.durationH);
}
