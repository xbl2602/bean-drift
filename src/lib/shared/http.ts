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

/** 校验失败 -> 400，并告诉调用方哪个字段不对（不透传内部信息）。 */
export function validationErrorResponse(error: z.ZodError): Response {
  const details = error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }));
  return errorResponse("invalid_input", "Some inputs are missing or out of range.", 400, details);
}
