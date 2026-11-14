import { z } from "zod";
import { AgentError, LIMITS, type Complete } from "../logic/contracts";

const responseSchema = z.object({ choices: z.array(z.object({
  finish_reason: z.enum(["stop", "tool_calls"]),
  message: z.object({
    content: z.string().max(16000).nullable().optional(),
    tool_calls: z.array(z.object({
      id: z.string().min(1).max(128), type: z.literal("function"),
      function: z.object({ name: z.string().max(100), arguments: z.string().max(8192) }),
    })).max(LIMITS.toolCalls).optional(),
  }),
})).length(1) });

/** Server-side adapter; key is injected at request time, never returned or logged. */
export function createDeepSeekComplete(apiKey: string, fetcher: typeof fetch = fetch): Complete {
  if (typeof window !== "undefined") throw new Error("The model adapter is server-only.");
  return async ({ messages, tools, signal }) => {
    if (!apiKey.trim()) throw new AgentError("not_configured", 503, "The assistant is not configured yet.");
    const wireMessages = messages.map(message => {
      if (message.role === "tool") return { role: "tool", content: message.content, tool_call_id: message.callId };
      if (message.role === "assistant") return {
        role: "assistant", content: message.content || null,
        ...(message.toolCalls.length ? { tool_calls: message.toolCalls.map(call => ({
          id: call.id, type: "function", function: { name: call.name, arguments: JSON.stringify(call.arguments) },
        })) } : {}),
      };
      return message;
    });
    // Fixed official origin: an environment URL cannot redirect credentials elsewhere.
    const response = await fetcher("https://api.deepseek.com/chat/completions", {
      method: "POST", signal, redirect: "error",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "deepseek-flash", messages: wireMessages, stream: false,
        thinking: { type: "disabled" }, max_tokens: LIMITS.outputTokens,
        tools: tools.map(tool => ({ type: "function", function: {
          name: tool.name, description: tool.description,
          parameters: z.toJSONSchema(tool.inputSchema, { io: "input" }),
        } })),
      }),
    });
    if (!response.ok) {
      await response.body?.cancel();
      if (response.status === 429) throw new AgentError("rate_limited", 429, "DeepSeek is at its request limit. Please try again later.");
      throw new AgentError("provider_unavailable", 503, "The AI service is unavailable. Please try again later.");
    }
    const reader = response.body?.getReader();
    if (!reader) throw new AgentError("model_error", 502, "The model returned an invalid response.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > LIMITS.responseBytes) {
          await reader.cancel();
          throw new Error("Response too large");
        }
        chunks.push(part.value);
      }
      const parsed = responseSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      const choice = parsed.choices[0];
      const toolCalls = (choice.message.tool_calls ?? []).map(call => ({
        id: call.id, name: call.function.name, arguments: JSON.parse(call.function.arguments) as unknown,
      }));
      if ((choice.finish_reason === "tool_calls") !== (toolCalls.length > 0)) throw new Error("Inconsistent response");
      return { content: choice.message.content ?? "", toolCalls };
    } catch {
      throw new AgentError("model_error", 502, "The model returned an invalid or incomplete response.");
    } finally {
      reader.releaseLock();
    }
  };
}
