import type { ReadTool } from "../../../core/tool";

export type ToolCall = { id: string; name: string; arguments: unknown };
export type Message =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string; toolCalls: ToolCall[] }
  | { role: "tool"; content: string; callId: string };
export type ModelReply = { content: string; toolCalls: ToolCall[] };
export type Complete = (input: {
  messages: Message[];
  tools: readonly ReadTool[];
  signal: AbortSignal;
}) => Promise<ModelReply>;
export type Source = { tool: string; input: unknown; result: unknown };
export class AgentError extends Error {
  constructor(public code: string, public status: number, message: string) {
    super(message);
    this.name = "AgentError";
  }
}
export const LIMITS = Object.freeze({
  messageChars: 2000, bodyBytes: 8192, modelCalls: 4, toolCalls: 8,
  outputTokens: 2400, resultBytes: 65536, responseBytes: 131072, timeoutMs: 25000,
});

