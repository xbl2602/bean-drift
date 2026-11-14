import { defineReadTool } from "@/core/tool";
import { getPointTimelineForQuery, pointTimelineInputSchema } from "../logic/get-point-timeline";

export const getPointTimelineTool = defineReadTool({
  name: "get_point_timeline",
  description:
    "How the Sun and the Earth move over a period at one lunar point (default 720 hours from the start time; up to 744 hours = 31 days, enough for a whole lunar day). " +
    "Returns, with the lunar terrain taken into account: the continuous time windows when the Sun is visible (solar power), when the Earth is visible (direct-to-Earth communication) and when both are visible at the same time, " +
    "each with the visible share of the period and the longest outage; plus a curve of Sun and Earth azimuth/elevation and a visible flag over time. " +
    "Use it for questions like 'when are the power and communication windows next month' or 'how long is the longest outage in this lunar day'. Optional minEarthElevationDeg requires the Earth to be higher than that angle.",
  access: "read",
  inputSchema: pointTimelineInputSchema,
  run: getPointTimelineForQuery,
});
