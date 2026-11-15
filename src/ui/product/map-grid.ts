/** CSS-pixel zoom thresholds shared by the 2D map and 3D globe. Three grid levels in total: 30° always, then 10°, then 1°. */
export const MAJOR_GRID_STEP_DEG = 30;
export const MINOR_GRID_LEVELS = [
  { stepDeg: 10, minPixelsPerDegree: 6 },
  { stepDeg: 1, minPixelsPerDegree: 32 },
] as const;

/** Fade the finer level in before retiring the coarser minor grid. */
export function gridDetailWeights(pixelsPerDegree: number): [number, number] {
  const zoom = Number.isFinite(pixelsPerDegree) ? Math.max(0, pixelsPerDegree) : 0;
  const active = MINOR_GRID_LEVELS.map(level => {
    const t = Math.max(0, Math.min(1, (zoom - level.minPixelsPerDegree) / (level.minPixelsPerDegree * 0.2)));
    return t * t * (3 - 2 * t);
  });
  return [active[0] * (1 - active[1]), active[1]];
}
