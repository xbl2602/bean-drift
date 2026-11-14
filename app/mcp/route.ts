// MCP 入口（Streamable HTTP）。很薄：只转调 src/core/mcp。
import { handleMcpPost } from "@/core/mcp/server";

export const POST = handleMcpPost;

// 本服务不提供服务端推送流，所以不支持 GET（按 MCP 规范返回 405）。
export function GET(): Response {
  return new Response("This MCP endpoint accepts POST (Streamable HTTP, no server-initiated stream).", {
    status: 405,
    headers: { Allow: "POST" },
  });
}
