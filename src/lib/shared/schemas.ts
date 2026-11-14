// 各入口（API、MCP、agent）共用的输入校验规则。边界处校验：不信任浏览器和 AI 传来的任何参数。
import { z } from "zod";

/** 星历适用的时间范围（截断理论在 2000 年前后几十年内精度可靠）。 */
const MIN_TIME_MS = Date.UTC(2000, 0, 1);
const MAX_TIME_MS = Date.UTC(2100, 0, 1);

export const latDegSchema = z.number().min(-90).max(90).describe("Selenographic latitude in degrees, north positive, -90 to 90");
export const lonDegSchema = z.number().min(-180).max(360).describe("Selenographic longitude in degrees, east positive, -180 to 360");

export const positionSchema = z.object({ latDeg: latDegSchema, lonDeg: lonDegSchema });

const utcTimeInRange = z.iso.datetime().refine((value) => {
  const ms = Date.parse(value);
  return ms >= MIN_TIME_MS && ms < MAX_TIME_MS;
}, "time must be between 2000-01-01 and 2100-01-01 (UTC)");

/** 可选的 UTC 时间，必须带 Z，例如 2030-01-01T12:00:00Z。不传则用当前时间。 */
export const timeUtcSchema = utcTimeInRange.optional().describe("UTC time in ISO 8601 with a trailing Z, e.g. 2030-01-01T12:00:00Z. Defaults to now. Valid 2000-2100.");

/** 必填的 UTC 时间（比较多个日期时用）。 */
export const requiredTimeUtcSchema = utcTimeInRange.describe("UTC time in ISO 8601 with a trailing Z, e.g. 2030-01-01T12:00:00Z. Valid 2000-2100.");

/**
 * 通信要求的地球最低仰角（选填）。不传 = 只看地形，和整月地图、一年统计的默认口径一致。
 * 注意：不传和传 0 不一样——传 0 还额外要求地球不低于光滑球面的水平线。
 */
export const minEarthElevationDegSchema = z
  .number()
  .min(0)
  .max(60)
  .optional()
  .describe(
    "Optional. Minimum elevation in degrees the Earth must be above to count as visible for direct communication (applied to the upper edge of the Earth's disk, like the terrain rule). Omit to use the terrain only. Affects the Earth only. 0 to 60.",
  );

export const MAX_COMPARE_POINTS = 10;
/** 同一批点跨日期对比：点数 × 日期数不能太大，否则单次返回太大、算得也慢。 */
export const MAX_COMPARE_DATES_POINTS = 5;
export const MAX_COMPARE_DATES_TIMES = 8;

export function resolveTimeMs(timeUtc: string | undefined): number {
  return timeUtc === undefined ? Date.now() : Date.parse(timeUtc);
}
