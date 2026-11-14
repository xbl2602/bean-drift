// 向本站的 /api/point 要一个点、一个时刻的完整参数（含地形遮挡后的可见性、一年统计）。
// 只请求本站同源的接口，不直接读任何数据文件；出错时只给用户看得懂的提示，不透传服务器原文。
import type { PointConditions } from "@/core/types";
import { normalizeLonDeg, type LatLon } from "../moon-frames";

export class PointApiError extends Error {}

function describeFailure(status: number): string {
  if (status === 400) return "This place or time is outside the range the data service supports.";
  if (status === 429) return "Too many requests. Please wait a moment.";
  return "Terrain-adjusted data is unavailable right now.";
}

function isPointConditions(value: unknown): value is PointConditions {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return !!v.visibility && typeof v.visibility === "object" && !!v.yearStats && typeof v.yearStats === "object" && !!v.provenance && typeof v.provenance === "object";
}

export async function fetchPointConditions(point: LatLon, timeMs: number, signal: AbortSignal): Promise<PointConditions> {
  const query = new URLSearchParams({
    latDeg: String(point.latDeg),
    lonDeg: String(normalizeLonDeg(point.lonDeg)),
    time: new Date(timeMs).toISOString(),
  });
  let response: Response;
  try {
    response = await fetch(`/api/point?${query}`, { signal });
  } catch (cause) {
    if (signal.aborted) throw cause;
    throw new PointApiError("Could not reach the data service.");
  }
  if (!response.ok) throw new PointApiError(describeFailure(response.status));
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new PointApiError("The data service returned an unreadable answer.");
  }
  if (!isPointConditions(body)) throw new PointApiError("The data service returned an unreadable answer.");
  return body;
}
