// GET /api/presets
import { jsonResponse } from "@/lib/shared/http";
import { listPresetsForQuery } from "../logic/list-presets";

export function GET(): Response {
  return jsonResponse(listPresetsForQuery());
}
