// POST /api/compare-dates  body: { "points": [{ "latDeg": -89.71, "lonDeg": 62.5 }], "times": ["2030-01-10T00:00:00Z", "2030-07-10T00:00:00Z"] }
import { errorResponse, jsonResponse, readJsonBody, validationErrorResponse } from "@/lib/shared/http";
import { compareDates, compareDatesInputSchema } from "../logic/compare-dates";

/** 请求体大小上限（字节）：最多 5 个点、8 个时刻，远小于这个值。 */
const MAX_BODY_BYTES = 8 * 1024;

export async function POST(request: Request): Promise<Response> {
  const read = await readJsonBody(request, MAX_BODY_BYTES);
  if (!read.ok) return read.response;

  const parsed = compareDatesInputSchema.safeParse(read.body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    return jsonResponse(compareDates(parsed.data));
  } catch {
    return errorResponse("internal_error", "Could not compare these dates.", 500);
  }
}
