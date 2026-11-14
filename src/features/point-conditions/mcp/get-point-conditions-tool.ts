// MCP / agent 工具定义：名字、参数 schema、描述 -> 调用 logic。
import { defineReadTool } from "@/core/tool";
import { getPointConditionsForQuery, pointConditionsInputSchema } from "../logic/get-point-conditions";

export const getPointConditionsTool = defineReadTool({
  name: "get_point_conditions",
  description:
    "Get lunar surface conditions at one point and time. Available now: the Sun's and Earth's azimuth/elevation (relative to a smooth-sphere horizon, no terrain occlusion), distances, apparent radii and Earth's phase. " +
    "The response also has three groups that are not computed yet: terrain (height, slope, aspect, horizon profile), visibility (terrain-aware disk visibility and next rise/set of the Sun and Earth) and yearStats (visible fraction, longest outage, visible windows). " +
    "Their fields are null; check provenance.terrain / provenance.visibility / provenance.yearStats: status 'unavailable' means not wired in yet, so null does not mean there is no terrain.",
  access: "read",
  inputSchema: pointConditionsInputSchema,
  run: getPointConditionsForQuery,
});
