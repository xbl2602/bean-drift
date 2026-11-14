// POST /api/find-sites  body: { "maxSlopeDeg": 10, "maxLongestSunOutageH": 120, "latMaxDeg": -80, "limit": 5 }   （条件都选填）
import { errorResponse, jsonResponse, readJsonBody, validationErrorResponse } from "@/lib/shared/http";
import { findSitesForQuery, findSitesInputSchema } from "../logic/find-sites";

const MAX_BODY_BYTES = 4 * 1024;

export async function POST(request: Request): Promise<Response> {
  const read = await readJsonBody(request, MAX_BODY_BYTES);
  if (!read.ok) return read.response;

  const parsed = findSitesInputSchema.safeParse(read.body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    return jsonResponse(findSitesForQuery(parsed.data));
  } catch {
    return errorResponse("internal_error", "Could not search the lunar maps right now.", 500);
  }
}
