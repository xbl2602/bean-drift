// 很薄的一层：解析 HTTP 请求 -> 调用 logic -> 包装响应。
// GET /api/point?latDeg=-89.71&lonDeg=62.5&time=2030-01-01T12:00:00Z&minEarthElevationDeg=5&statsStart=2027-03-01T00:00:00Z
// （time、minEarthElevationDeg、statsStart 选填；statsStart = 一年统计从哪一刻开始算，默认 2030-01-01）
import { errorResponse, jsonResponse, readNumberParam, validationErrorResponse } from "@/lib/shared/http";
import { getPointConditionsForQuery, pointConditionsInputSchema } from "../logic/get-point-conditions";

export function GET(request: Request): Response {
  const params = new URL(request.url).searchParams;
  const parsed = pointConditionsInputSchema.safeParse({
    latDeg: readNumberParam(params, "latDeg"),
    lonDeg: readNumberParam(params, "lonDeg"),
    time: params.get("time") ?? undefined,
    minEarthElevationDeg: readNumberParam(params, "minEarthElevationDeg"),
    statsStart: params.get("statsStart") ?? undefined,
  });
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    return jsonResponse(getPointConditionsForQuery(parsed.data));
  } catch {
    return errorResponse("internal_error", "Could not compute conditions for this point.", 500);
  }
}
