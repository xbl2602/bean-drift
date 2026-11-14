// 纯业务函数：按条件在整个月面里找位置（坡度、日照、通信、最长断电……）。
import { z } from "zod";
import { findSites } from "@/core/data";
import type { FindSitesResult } from "@/core/data";
import { latDegSchema } from "@/lib/shared/schemas";

const fraction = (text: string) => z.number().min(0).max(1).optional().describe(text);
const hours = (text: string) => z.number().min(0).max(8760).optional().describe(text);
const lonBound = (text: string) => z.number().min(-180).max(180).optional().describe(text);

export const findSitesInputSchema = z
  .object({
    maxSlopeDeg: z.number().min(0).max(90).optional().describe("Only cells with a mean slope at or below this many degrees (the slope is a 0.25 degree cell mean, not a landing-safety slope)."),
    minSunVisibleFraction: fraction("Only cells where the Sun is visible at least this share of the year, 0 to 1."),
    minEarthVisibleFraction: fraction("Only cells where the Earth is visible at least this share of the year, 0 to 1."),
    minBothVisibleFraction: fraction("Only cells where the Sun and the Earth are visible at the same time at least this share of the year, 0 to 1."),
    maxLongestSunOutageH: hours("Only cells whose longest single stretch without Sun (power outage) in the year is at most this many hours."),
    maxLongestEarthOutageH: hours("Only cells whose longest single stretch without Earth (no direct communication) in the year is at most this many hours."),
    latMinDeg: latDegSchema.optional().describe("Southern edge of the search area in degrees (default -90)."),
    latMaxDeg: latDegSchema.optional().describe("Northern edge of the search area in degrees (default 90). The lunar south pole region is latMaxDeg -80."),
    lonMinDeg: lonBound("Western edge of the search area in degrees east, -180 to 180 (default -180). The area may not cross the 180 degree meridian."),
    lonMaxDeg: lonBound("Eastern edge of the search area in degrees east, -180 to 180 (default 180)."),
    rankBy: z
      .enum(["bothVisibleFraction", "sunVisibleFraction", "earthVisibleFraction", "lowestSlope"])
      .default("bothVisibleFraction")
      .describe("How to order the results, best first. Default bothVisibleFraction (Sun and Earth visible at the same time)."),
    limit: z.number().int().min(1).max(20).default(10).describe("How many places to return, 1 to 20. Default 10."),
    minSeparationKm: z
      .number()
      .min(0)
      .max(1000)
      .default(50)
      .describe("Returned places are at least this far apart, in km, so you do not get ten neighbouring cells. Default 50."),
  })
  .refine((input) => (input.latMinDeg ?? -90) <= (input.latMaxDeg ?? 90), { path: ["latMinDeg"], message: "latMinDeg must not be greater than latMaxDeg" })
  .refine((input) => (input.lonMinDeg ?? -180) <= (input.lonMaxDeg ?? 180), { path: ["lonMinDeg"], message: "lonMinDeg must not be greater than lonMaxDeg" });

export type FindSitesInput = z.output<typeof findSitesInputSchema>;

export interface FindSitesAnswer extends FindSitesResult {
  /** 实际用上的条件（含默认值），让调用方知道没写的条件是"不限制"。 */
  query: FindSitesInput;
}

export function findSitesForQuery(input: FindSitesInput): FindSitesAnswer {
  const { rankBy, limit, minSeparationKm, ...criteria } = input;
  return { query: input, ...findSites(criteria, { rankBy, limit, minSeparationKm }) };
}
