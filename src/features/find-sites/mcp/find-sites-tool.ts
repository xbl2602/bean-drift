import { defineReadTool } from "@/core/tool";
import { findSitesForQuery, findSitesInputSchema } from "../logic/find-sites";

export const findSitesTool = defineReadTool({
  name: "find_sites",
  description:
    "Search the whole Moon for places that meet conditions and return the best ones, e.g. 'flat places (slope under 10 degrees) near the south pole whose longest power outage in a year is under 120 hours'. " +
    "Conditions (all optional): maximum slope, minimum share of the year with Sun / Earth / both visible, maximum longest outage without Sun or without Earth, and a latitude/longitude box. " +
    "Results are 0.25 degree map cells (about 7.6 km, position = cell centre), ranked by rankBy and spaced apart, each with height, slope, the visible shares, the longest outages and mean outage / Earth window lengths for the 8760 hours from 2030-01-01. " +
    "matchedCells says how many cells met the conditions in total. Inspect a returned place in detail with get_point_conditions or get_point_timeline. " +
    "Coarse screening only: the Earth rule has no minimum elevation, the slope is a cell mean, and it is not mission-grade.",
  access: "read",
  inputSchema: findSitesInputSchema,
  run: findSitesForQuery,
});
