// REST 路由的公共小工具：统一的成功/错误响应格式。
import type { z } from "zod";

export interface ApiError {
  error: { code: string; message: string; details?: unknown };
}

export function jsonResponse(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function errorResponse(code: string, message: string, status: number, details?: unknown): Response {
  const body: ApiError = { error: { code, message, ...(details === undefined ? {} : { details }) } };
  return jsonResponse(body, status);
}

/** URL 参数都是字符串；缺了或为空就当"没给"，让校验去报错（避免空串被悄悄当成 0）。 */
export function readNumberParam(params: URLSearchParams, name: string): number | undefined {
  const raw = params.get(name);
  if (raw === null || raw.trim() === "") return undefined;
  return Number(raw);
}

/** 读 JSON 请求体：太大 -> 413，不是 JSON -> 400，通过则返回解析后的内容。 */
export async function readJsonBody(request: Request, maxBytes: number): Promise<{ ok: true; body: unknown } | { ok: false; response: Response }> {
  let text: string;
  try {
    text = await request.text();
  } catch {
    return { ok: false, response: errorResponse("invalid_body", "Could not read the request body.", 400) };
  }
  if (text.length > maxBytes) return { ok: false, response: errorResponse("body_too_large", "Request body is too large.", 413) };
  try {
    return { ok: true, body: JSON.parse(text) };
  } catch {
    return { ok: false, response: errorResponse("invalid_json", "Request body must be valid JSON.", 400) };
  }
}

/** 校验失败 -> 400，并告诉调用方哪个字段不对（不透传内部信息）。 */
export function validationErrorResponse(error: z.ZodError): Response {
  const details = error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }));
  return errorResponse("invalid_input", "Some inputs are missing or out of range.", 400, details);
}
