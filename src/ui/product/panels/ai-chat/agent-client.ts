// 调用 POST /api/agent（约定见 docs/SHARED_INTERFACES.md 第 6 节）。只发 { message }，没有对话历史；
// answer 是纯文本，界面里只能当文字显示；sources 为空表示这条回答没有经过月面数据工具核对。
// 出错时给用户看得懂的话，不自动重发（每次请求都花钱）。

export interface AgentSource { tool: string; input: unknown; result: unknown }
export interface AgentReply { answer: string; sources: AgentSource[] }

const STATUS_MESSAGES: Record<number, string> = {
  400: "Please ask a question of 1–2,000 characters.",
  404: "The assistant is not connected yet. Please try again later.",
  413: "That question is too long. Please shorten it.",
  422: "That question needs too many steps. Try one place or one date at a time.",
  429: "Too many questions in a short time. Please wait a minute, then send again.",
  502: "The assistant could not read the lunar data. Please send again.",
  503: "The assistant is not available right now. Please try again later.",
  504: "That took too long. Try a more specific question.",
};
const MAX_MESSAGE_CHARS = 2000;

export async function askAgent(message: string, signal: AbortSignal): Promise<AgentReply> {
  let response: Response;
  try {
    response = await fetch("/api/agent", {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: message.slice(0, MAX_MESSAGE_CHARS) }),
    });
  } catch (cause) {
    if (signal.aborted) throw cause;
    throw new Error("Could not reach the assistant. Check your connection and try again.");
  }
  if (!response.ok) throw new Error(STATUS_MESSAGES[response.status] ?? "Something went wrong. Please try again.");
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error("The assistant sent an unreadable reply. Please try again.");
  }
  if (!isAgentReply(data)) throw new Error("The assistant sent an unreadable reply. Please try again.");
  return { answer: data.answer.trim(), sources: data.sources };
}

function isAgentReply(data: unknown): data is AgentReply {
  if (!data || typeof data !== "object") return false;
  const { answer, sources } = data as Record<string, unknown>;
  return typeof answer === "string" && answer.trim().length > 0 && Array.isArray(sources) && sources.length <= 8
    && sources.every((source) => source && typeof source === "object" && typeof (source as AgentSource).tool === "string");
}
