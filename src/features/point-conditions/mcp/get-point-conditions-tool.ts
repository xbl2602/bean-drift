// MCP / agent 工具定义：名字、参数 schema、描述 -> 调用 logic。
import { defineReadTool } from "@/core/tool";
import { getPointConditionsForQuery, pointConditionsInputSchema } from "../logic/get-point-conditions";

export const getPointConditionsTool = defineReadTool({
  name: "get_point_conditions",
  description:
    "Get lunar surface conditions at one point and time: the Sun's and Earth's azimuth/elevation (relative to a smooth-sphere horizon, no terrain occlusion), Earth's distance and phase. Terrain and year statistics are not available yet and are returned as null with a provenance note.",
  access: "read",
  inputSchema: pointConditionsInputSchema,
  run: getPointConditionsForQuery,
});
