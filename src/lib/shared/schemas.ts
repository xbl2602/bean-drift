// 各入口（API、MCP、agent）共用的输入校验规则。边界处校验：不信任浏览器和 AI 传来的任何参数。
import { z } from "zod";

/** 星历适用的时间范围（截断理论在 2000 年前后几十年内精度可靠）。 */
const MIN_TIME_MS = Date.UTC(2000, 0, 1);
const MAX_TIME_MS = Date.UTC(2100, 0, 1);

export const latDegSchema = z.number().min(-90).max(90).describe("Selenographic latitude in degrees, north positive, -90 to 90");
export const lonDegSchema = z.number().min(-180).max(360).describe("Selenographic longitude in degrees, east positive, -180 to 360");

export const positionSchema = z.object({ latDeg: latDegSchema, lonDeg: lonDegSchema });

/** 可选的 UTC 时间，必须带 Z，例如 2030-01-01T12:00:00Z。不传则用当前时间。 */
export const timeUtcSchema = z.iso
  .datetime()
  .refine((value) => {
    const ms = Date.parse(value);
    return ms >= MIN_TIME_MS && ms < MAX_TIME_MS;
  }, "time must be between 2000-01-01 and 2100-01-01 (UTC)")
  .optional()
  .describe("UTC time in ISO 8601 with a trailing Z, e.g. 2030-01-01T12:00:00Z. Defaults to now. Valid 2000-2100.");

export const MAX_COMPARE_POINTS = 10;

export function resolveTimeMs(timeUtc: string | undefined): number {
  return timeUtc === undefined ? Date.now() : Date.parse(timeUtc);
}
