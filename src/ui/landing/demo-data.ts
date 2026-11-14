import type { PointConditions } from "@/core/types";

export const DEMO_SITES = [
  { name: "Ridge A", latDeg: -89.71, lonDeg: 62.5 },
  { name: "Ridge B", latDeg: -89.61, lonDeg: 75.8 },
  { name: "Apollo 11", latDeg: 0.67416, lonDeg: 23.47314 },
] as const;
export const DEMO_EPOCH = "2026-11-14T12:00:00Z";
export const DAY_MS = 86_400_000;

export async function queryPoint(site: { latDeg: number; lonDeg: number }, time: string, signal: AbortSignal): Promise<PointConditions> {
  const params = new URLSearchParams({ latDeg: String(site.latDeg), lonDeg: String(site.lonDeg), time });
  const response = await fetch(`/api/point?${params}`, { signal });
  if (!response.ok) throw new Error("Could not load sky positions.");
  return response.json();
}

export function angle(degrees: number) {
  return `${degrees >= 0 ? "+" : "−"}${Math.abs(degrees).toFixed(1)}°`;
}
