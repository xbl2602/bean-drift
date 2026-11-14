// 很薄的一层：解析 HTTP 请求 -> 调用 logic -> 包装响应。
// GET /api/timeline?latDeg=-89.71&lonDeg=62.5&time=2030-01-01T00:00:00Z&durationH=720&stepMin=60&minEarthElevationDeg=5
// 只有 latDeg、lonDeg 必填。
import { errorResponse, jsonResponse, readNumberParam, validationErrorResponse } from "@/lib/shared/http";
import { getPointTimelineForQuery, pointTimelineInputSchema } from "../logic/get-point-timeline";

export function GET(request: Request): Response {
  const params = new URL(request.url).searchParams;
  const parsed = pointTimelineInputSchema.safeParse({
    latDeg: readNumberParam(params, "latDeg"),
    lonDeg: readNumberParam(params, "lonDeg"),
    time: params.get("time") ?? undefined,
    durationH: readNumberParam(params, "durationH"),
    stepMin: readNumberParam(params, "stepMin"),
    minEarthElevationDeg: readNumberParam(params, "minEarthElevationDeg"),
  });
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    return jsonResponse(getPointTimelineForQuery(parsed.data));
  } catch {
    return errorResponse("internal_error", "Could not compute the timeline for this point.", 500);
  }
}
