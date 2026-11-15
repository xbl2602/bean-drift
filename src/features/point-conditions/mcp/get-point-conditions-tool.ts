// MCP / agent 工具定义：名字、参数 schema、描述 -> 调用 logic。
import { defineReadTool } from "@/core/tool";
import { getPointConditionsForQuery, pointConditionsInputSchema } from "../logic/get-point-conditions";

export const getPointConditionsTool = defineReadTool({
  name: "get_point_conditions",
  description:
    "Get lunar surface conditions at one point and one moment. Returns: the Sun's and Earth's azimuth/elevation (relative to a smooth-sphere horizon), distances, apparent radii and Earth's phase; " +
    "terrain (height, slope, aspect, horizon profile from NASA LOLA, 0.25 degree map cells); terrain-aware visibility (share of each disk above the terrain horizon now, and the next rise and set times of the Sun and the Earth); " +
    "and yearStats (the 8760 hours from 2030-01-01 unless statsStart is given: share of time the Sun / the Earth / both are visible, longest outage, mean outage and visible window lengths, and the visible windows). " +
    "The terrain, visibility and yearStats groups can be null if the precomputed data cannot be read on the server; check provenance.<group>.status ('unavailable' means null is not 'no terrain'). " +
    "Optional statsStart (UTC) moves the start of the yearStats period, e.g. to the launch or landing time, so you get the year that follows it. " +
    "Optional minEarthElevationDeg requires the Earth to be higher than that angle to count as visible (direct communication needs a minimum elevation); omit it to use the terrain only.",
  access: "read",
  inputSchema: pointConditionsInputSchema,
  run: getPointConditionsForQuery,
});
