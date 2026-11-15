// 很薄的一层：解析 HTTP 请求 -> 调用 logic -> 包装响应。
// GET /api/energy?latDeg=-89.71&lonDeg=62.5&time=2030-01-01T00:00:00Z&durationH=720
// 只有 latDeg、lonDeg 必填。
import { errorResponse, jsonResponse, readNumberParam, validationErrorResponse } from "@/lib/shared/http";
import { getSolarEnergyForQuery, solarEnergyInputSchema } from "../logic/get-solar-energy";

export function GET(request: Request): Response {
  const params = new URL(request.url).searchParams;
  const parsed = solarEnergyInputSchema.safeParse({
    latDeg: readNumberParam(params, "latDeg"),
    lonDeg: readNumberParam(params, "lonDeg"),
    time: params.get("time") ?? undefined,
    durationH: readNumberParam(params, "durationH"),
  });
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    return jsonResponse(getSolarEnergyForQuery(parsed.data));
  } catch {
    return errorResponse("internal_error", "Could not estimate the solar energy for this point.", 500);
  }
}
