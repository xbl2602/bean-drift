import type { ReadTool } from "../../../core/tool";
import { AgentError, LIMITS, type Complete } from "../logic/contracts";
import { questionSchema, runAgent } from "../logic/run-agent";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}

async function readQuestion(request: Request, signal: AbortSignal) {
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
    throw new AgentError("invalid_input", 400, "Send the question as JSON.");
  }
  const reader = request.body?.getReader();
  if (!reader) throw new AgentError("invalid_input", 400, "Enter a question.");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    signal.throwIfAborted();
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > LIMITS.bodyBytes) {
        await reader.cancel();
        throw new AgentError("body_too_large", 413, "The request is too large.");
      }
      chunks.push(part.value);
    }
    try {
      return questionSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    } catch {
      throw new AgentError("invalid_input", 400, "Send only a message containing 1–2000 characters.");
    }
  } finally {
    signal.removeEventListener("abort", cancel);
    reader.releaseLock();
  }
}

export function createAgentHandler(options: {
  tools: readonly ReadTool[];
  getComplete: () => Complete;
  timeoutMs?: number;
}) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "POST" } });
    const controller = new AbortController();
    const abort = () => controller.abort();
    request.signal.addEventListener("abort", abort, { once: true });
    let timer: ReturnType<typeof setTimeout> | undefined;
    let onAbort: (() => void) | undefined;
    try {
      const cancelled = new Promise<never>((_, reject) => {
        onAbort = () => reject(new AgentError("timeout", 504, "The request timed out or was cancelled. Please try again."));
        controller.signal.addEventListener("abort", onAbort, { once: true });
      });
      timer = setTimeout(abort, options.timeoutMs ?? LIMITS.timeoutMs);
      if (request.signal.aborted) abort();
      const work = async () => {
        const question = await readQuestion(request, controller.signal);
        controller.signal.throwIfAborted();
        return runAgent(question, { complete: options.getComplete(), tools: options.tools, signal: controller.signal });
      };
      return json(await Promise.race([cancelled, work()]));
    } catch (error) {
      const safe = error instanceof AgentError ? error : new AgentError("service_error", 503, "The assistant could not complete this request.");
      return json({ error: { code: safe.code, message: safe.message } }, safe.status);
    } finally {
      clearTimeout(timer);
      request.signal.removeEventListener("abort", abort);
      if (onAbort) controller.signal.removeEventListener("abort", onAbort);
    }
  };
}
