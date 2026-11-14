export type SearchResult = {
  answer: string;
  sources: { tool: string; input: unknown; result: unknown }[];
  model: string;
};

export async function searchLunarData(message: string, signal: AbortSignal): Promise<SearchResult> {
  const response = await fetch("/api/agent", {
    method: "POST", signal, headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  if (!response.ok) {
    const errors: Record<number, string> = {
      400: "Please enter a question of 1–2000 characters.",
      404: "The lunar assistant is not connected yet. Please try again after setup.",
      413: "This question is too long. Please shorten it.",
      422: "This question needs too many steps. Try one location or one date.",
      // 429 has two sources (the site's per-IP limit and DeepSeek's own); the client only sees the status code.
      429: "Too many requests. Please wait a minute and try again.",
      502: "The assistant could not read the lunar data. Please try again.",
      503: "The assistant is not available yet. Please try again later.",
      504: "The search took too long. Try a more specific question.",
    };
    throw new Error(errors[response.status] ?? "Search failed. Please try again later.");
  }
  let data: unknown;
  try { data = await response.json(); }
  catch { throw new Error("The assistant returned an unreadable answer. Please try again."); }
  if (!data || typeof data !== "object" || !("answer" in data) || typeof data.answer !== "string" || !data.answer.trim()
    || !("sources" in data) || !Array.isArray(data.sources) || data.sources.length > 8
    || !data.sources.every(source => source && typeof source === "object" && typeof source.tool === "string" && "input" in source && "result" in source)) {
    throw new Error("The assistant returned an unreadable answer. Please try again.");
  }
  return { answer: data.answer, sources: data.sources, model: "DeepSeek Flash" };
}
