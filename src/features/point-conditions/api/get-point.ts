// 很薄的一层：解析 HTTP 请求 -> 调用 logic -> 包装响应。
// GET /api/point?latDeg=-89.71&lonDeg=62.5&time=2030-01-01T12:00:00Z
import { errorResponse, jsonResponse, validationErrorResponse } from "@/lib/shared/http";
import { getPointConditionsForQuery, pointConditionsInputSchema } from "../logic/get-point-conditions";

/** URL 参数都是字符串；缺了或为空就当"没给"，让校验去报错（避免空串被悄悄当成 0）。 */
function readNumberParam(params: URLSearchParams, name: string): number | undefined {
  const raw = params.get(name);
  if (raw === null || raw.trim() === "") return undefined;
  return Number(raw);
}

export function GET(request: Request): Response {
  const params = new URL(request.url).searchParams;
  const parsed = pointConditionsInputSchema.safeParse({
    latDeg: readNumberParam(params, "latDeg"),
    lonDeg: readNumberParam(params, "lonDeg"),
    time: params.get("time") ?? undefined,
  });
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    return jsonResponse(getPointConditionsForQuery(parsed.data));
  } catch {
    return errorResponse("internal_error", "Could not compute conditions for this point.", 500);
  }
}
