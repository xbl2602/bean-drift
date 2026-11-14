// 纯业务函数：不依赖 HTTP / Next.js / MCP，网页、API、MCP、agent 都调用它。
import { z } from "zod";
import { getPointConditions } from "@/core/data";
import type { PointConditions } from "@/core/types";
import { latDegSchema, lonDegSchema, resolveTimeMs, timeUtcSchema } from "@/lib/shared/schemas";

export const pointConditionsInputSchema = z.object({
  latDeg: latDegSchema,
  lonDeg: lonDegSchema,
  time: timeUtcSchema,
});

export type PointConditionsInput = z.output<typeof pointConditionsInputSchema>;

export function getPointConditionsForQuery(input: PointConditionsInput): PointConditions {
  return getPointConditions({ latDeg: input.latDeg, lonDeg: input.lonDeg }, resolveTimeMs(input.time));
}
