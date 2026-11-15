import { z } from "zod";

// Parse only the fields we draw. Unsupported/invalid results keep their text + raw sources.
const number = z.number().finite();
const fraction = number.min(0).max(1).nullable();
export const positionSchema = z.object({ latDeg: number.min(-90).max(90), lonDeg: number.min(-180).max(180) });
const utc = z.string().datetime();
const provenance = z.object({ status: z.enum(["ok", "unavailable"]), note: z.string() });
const direction = z.object({ azimuthDeg: number.min(0).max(360), elevationDeg: number.min(-90).max(90) });
export const pointVisualSchema = z.object({
  position: positionSchema, timeUtc: utc, sun: direction, earth: direction,
  terrain: z.object({ slopeDeg: number.nullable(), horizonProfile: z.array(direction).max(361).nullable() }),
  visibility: z.object({ sun: z.object({ diskVisibleFraction: fraction }), earth: z.object({ diskVisibleFraction: fraction }) }),
  yearStats: z.object({ periodStartUtc: utc.nullable(), periodEndUtc: utc.nullable(),
    sun: z.object({ visibleFraction: fraction }), earth: z.object({ visibleFraction: fraction }), bothVisibleFraction: fraction }),
  provenance: z.object({ terrain: provenance, visibility: provenance, yearStats: provenance }),
});
const windowSchema = z.object({ startUtc: utc, endUtc: utc, durationH: number.nonnegative() });
const summary = z.object({ visibleFraction: fraction, windows: z.array(windowSchema).max(1000) });
export const timelineVisualSchema = z.object({
  position: positionSchema, startUtc: utc, endUtc: utc,
  sun: summary, earth: summary, both: summary, provenance,
}).refine(data => {
  const start = Date.parse(data.startUtc), end = Date.parse(data.endUtc);
  return end > start && [data.sun, data.earth, data.both].every(body => body.windows.every(window =>
    Date.parse(window.startUtc) >= start && Date.parse(window.endUtc) <= end && Date.parse(window.endUtc) > Date.parse(window.startUtc)));
});
export const presetsVisualSchema = z.object({ presets: z.array(z.object({ name: z.string(), position: positionSchema })).max(50) });
export type PointVisual = z.infer<typeof pointVisualSchema>;
export type TimelineVisual = z.infer<typeof timelineVisualSchema>;
export const coordinates = (point: z.infer<typeof positionSchema>) => `${Math.abs(point.latDeg).toFixed(2)}°${point.latDeg < 0 ? "S" : "N"} · ${Math.abs(point.lonDeg).toFixed(2)}°${point.lonDeg < 0 ? "W" : "E"}`;
export const percent = (value: number | null) => value === null ? "Unavailable" : `${(value * 100).toFixed(1)}%`;
export const timeLabel = (utc: string) => utc.replace("T", " ").replace(/(?:\.\d+)?Z$/, " UTC");

export function comparisonPoints(result: unknown): PointVisual[] {
  const parsed = z.object({ results: z.array(z.unknown()).max(10) }).safeParse(result);
  if (!parsed.success) return [];
  // Do not drop an invalid point and silently change the comparison.
  const points = parsed.data.results.map(value => pointVisualSchema.safeParse(value));
  return points.every(point => point.success) ? points.flatMap(point => point.success ? [point.data] : []) : [];
}
