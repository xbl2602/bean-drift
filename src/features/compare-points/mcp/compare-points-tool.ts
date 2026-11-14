import { defineReadTool } from "@/core/tool";
import { comparePoints, comparePointsInputSchema } from "../logic/compare-points";

export const comparePointsTool = defineReadTool({
  name: "compare_points",
  description:
    "Compare lunar surface conditions at several points (up to 10) at the same time, returned in input order. Same fields as get_point_conditions for each point.",
  access: "read",
  inputSchema: comparePointsInputSchema,
  run: comparePoints,
});
