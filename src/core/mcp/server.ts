// MCP 服务（Streamable HTTP，无状态，只读工具）。同一个部署地址的 /mcp 就是 MCP 入口。
// 这里只实现 MCP 最小子集：initialize / ping / tools/list / tools/call，工具全部来自 registry 白名单。
// 每个请求独立处理，不保存会话（Vercel 上同一项目有多个实例并发，见 AGENTS.md 5.3）。
import { z } from "zod";
import { TOOLS } from "../registry";
import type { ReadTool } from "../tool";

const SERVER_INFO = { name: "bean-drift", version: "0.1.0" } as const;
const SUPPORTED_PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"] as const;
/** 请求体上限（字节）。 */
const MAX_BODY_BYTES = 32 * 1024;

const ERR_INVALID_REQUEST = -32600;
const ERR_METHOD_NOT_FOUND = -32601;
const ERR_INVALID_PARAMS = -32602;
const ERR_PARSE = -32700;

type JsonRpcId = string | number | null;

const requestSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string(), z.number()]).optional(),
  method: z.string(),
  params: z.record(z.string(), z.unknown()).optional(),
});

function rpcResult(id: JsonRpcId, result: unknown): Response {
  return Response.json({ jsonrpc: "2.0", id, result });
}

function rpcError(id: JsonRpcId, code: number, message: string, status = 200): Response {
  return Response.json({ jsonrpc: "2.0", id, error: { code, message } }, { status });
}

function describeTool(tool: ReadTool) {
  const { $schema: _ignored, ...inputSchema } = z.toJSONSchema(tool.inputSchema, { io: "input" });
  return { name: tool.name, description: tool.description, inputSchema, annotations: { readOnlyHint: true } };
}

async function callTool(id: JsonRpcId, params: Record<string, unknown> | undefined): Promise<Response> {
  const tool = TOOLS.find((candidate) => candidate.name === params?.name);
  if (!tool) return rpcError(id, ERR_INVALID_PARAMS, "Unknown tool.");

  const parsed = tool.inputSchema.safeParse(params?.arguments ?? {});
  if (!parsed.success) {
    // 参数错误按 MCP 约定作为"工具执行错误"返回，让模型能读到并自我纠正。
    const detail = parsed.error.issues.map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`).join("; ");
    return rpcResult(id, { isError: true, content: [{ type: "text", text: `Invalid arguments. ${detail}` }] });
  }

  try {
    const output = await tool.run(parsed.data);
    return rpcResult(id, { content: [{ type: "text", text: JSON.stringify(output) }], structuredContent: output });
  } catch {
    return rpcResult(id, { isError: true, content: [{ type: "text", text: "The tool failed. Try again with different inputs." }] });
  }
}

export async function handleMcpPost(request: Request): Promise<Response> {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return rpcError(null, ERR_INVALID_REQUEST, "Request is too large.", 413);

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return rpcError(null, ERR_PARSE, "Body must be valid JSON.", 400);
  }

  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) return rpcError(null, ERR_INVALID_REQUEST, "Expected one JSON-RPC 2.0 request (batches are not supported).", 400);

  const { id, method, params } = parsed.data;
  // 没有 id = 通知，不需要回复内容
  if (id === undefined) return new Response(null, { status: 202 });

  switch (method) {
    case "initialize": {
      const requested = typeof params?.protocolVersion === "string" ? params.protocolVersion : "";
      const protocolVersion = (SUPPORTED_PROTOCOLS as readonly string[]).includes(requested) ? requested : SUPPORTED_PROTOCOLS[0];
      return rpcResult(id, { protocolVersion, capabilities: { tools: { listChanged: false } }, serverInfo: SERVER_INFO });
    }
    case "ping":
      return rpcResult(id, {});
    case "tools/list":
      return rpcResult(id, { tools: TOOLS.map(describeTool) });
    case "tools/call":
      return callTool(id, params);
    default:
      return rpcError(id, ERR_METHOD_NOT_FOUND, "Method not found.");
  }
}
