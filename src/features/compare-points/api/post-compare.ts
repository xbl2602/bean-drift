// POST /api/compare  body: { "points": [{ "latDeg": -89.71, "lonDeg": 62.5 }, ...], "time": "2030-01-01T12:00:00Z" }
import { errorResponse, jsonResponse, validationErrorResponse } from "@/lib/shared/http";
import { comparePoints, comparePointsInputSchema } from "../logic/compare-points";

/** 请求体大小上限（字节）：10 个点远小于这个值，防止被塞超大 JSON。 */
const MAX_BODY_BYTES = 8 * 1024;

export async function POST(request: Request): Promise<Response> {
  let text: string;
  try {
    text = await request.text();
  } catch {
    return errorResponse("invalid_body", "Could not read the request body.", 400);
  }
  if (text.length > MAX_BODY_BYTES) return errorResponse("body_too_large", "Request body is too large.", 413);

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return errorResponse("invalid_json", "Request body must be valid JSON.", 400);
  }

  const parsed = comparePointsInputSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    return jsonResponse(comparePoints(parsed.data));
  } catch {
    return errorResponse("internal_error", "Could not compare these points.", 500);
  }
}
