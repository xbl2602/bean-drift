import { defineReadTool } from "@/core/tool";
import { compareDates, compareDatesInputSchema } from "../logic/compare-dates";

export const compareDatesTool = defineReadTool({
  name: "compare_dates",
  description:
    "Compare the same lunar points at several different moments (up to 5 points and 8 moments), e.g. 'this landing site in January versus July'. " +
    "For each point returns its terrain and one-year statistics once (they do not depend on the moment), and for every moment the Sun and Earth azimuth/elevation, how much of each disk is above the terrain horizon, and the next rise and set times. " +
    "To compare different places at one moment use compare_points instead. Optional minEarthElevationDeg requires the Earth to be higher than that angle.",
  access: "read",
  inputSchema: compareDatesInputSchema,
  run: compareDates,
});
