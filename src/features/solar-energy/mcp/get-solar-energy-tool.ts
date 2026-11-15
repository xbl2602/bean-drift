import { defineReadTool } from "@/core/tool";
import { getSolarEnergyForQuery, solarEnergyInputSchema } from "../logic/get-solar-energy";

export const getSolarEnergyTool = defineReadTool({
  name: "get_solar_energy_estimate",
  description:
    "Estimate how much direct sunlight a lunar point receives over a period (default 720 hours from the start time, up to 8760 = one year), with the lunar terrain taken into account. " +
    "Returns, per square metre of surface: the energy (Wh/m2), mean and peak power (W/m2) for three orientations - a panel that always faces the Sun (sunTracking), a vertical panel that turns about a vertical axis to face the Sun (verticalTracking) and a flat horizontal panel (horizontal) - " +
    "plus the share of time the Sun is visible, the longest dark period in hours and the battery energy that dark period needs per watt of constant load. " +
    "This is incident sunlight only: no panel efficiency, dust, degradation or reflected light, so multiply by your own panel efficiency and area. " +
    "Use it for questions like 'how much solar energy does this site get in a lunar day' or 'how big a battery do I need to survive the night here'.",
  access: "read",
  inputSchema: solarEnergyInputSchema,
  run: getSolarEnergyForQuery,
});
