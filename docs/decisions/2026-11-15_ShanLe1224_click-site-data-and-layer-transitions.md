# Click-to-inspect site data and continuous model-layer transitions

- Date: 2026-11-15
- Owner: ShanLe1224
- Scope: product UI and product display model only. Existing core APIs, data formats and measurements unchanged.

Single-click in Explore displays landing-site details. The standalone Select Landing Site menu entry is hidden; its internal detail panel feeds the existing comparison workflow. Double-click retains the first picked coordinate even when the details panel moves the globe between taps. Measurement clicks and other product modes retain their own behavior.

Solar elevation, Earth elevation and next-set times come from the existing point API. Energy comes from the existing energy API for an explicitly selected next 24 hours, 7 days or 30 days. Display incident kWh/m² for horizontal and sun-tracking panels; do not call it electrical generation. A body already below the horizon is labelled as set, and absent next-set events are not invented.

Hover no longer waits for the pointer to stop and clears its reading on every move. It samples the latest position at most every 80ms with one analysis in flight, keeps the previous labelled coordinate/value between updates, and does no new analysis at a stationary point.

Display-model corrections, applied to both CPU and GLSL:
- Monthly illumination integrates the positive fraction between successive sampled horizon/incidence margins, rather than counting each of 24 samples as wholly lit or dark. This reduces sampling steps without changing the sample count or inventing higher-resolution measurements. Polar terrain-horizon fractions stay in their original locations.
- Instantaneous incident sunlight is weighted by the fraction of the finite solar disk above the smooth horizon, replacing the old binary gate.
- Temperature blends the existing night baseline with solar heating in fourth-power radiative space, bounded by the same night and subsolar constants, replacing a hard maximum. This remains a steady illustrative model, does not simulate regolith heat storage and is not Diviner thermal imagery.

Blue/purple illumination regions denote low sunlight duration; they are not overlapping image layers and have not been repositioned for appearance. Real modelled shadow/low-light areas remain. The temperature map may still have a steep day–night contrast; the fix removes artificial discontinuities rather than blurring all boundaries or claiming measured accuracy.

Validation: numerical tests for finite-disk bounds/continuity, fractional horizon crossings and temperature continuity/bounds; browser inspection of both layers, moving-cursor readout, point details/energy and retained double-click first-person behavior. No new imagery, external data source or shared interface.
