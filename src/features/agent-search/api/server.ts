import type { ReadTool } from "../../../core/tool";
import { createAgentHandler } from "./create-handler";
import { createDeepSeekComplete } from "./deepseek";

/** Called only by a server route. Model and endpoint are fixed to the official Flash API. */
export function createLunarAgentPost(tools: readonly ReadTool[]) {
  return createAgentHandler({
    tools,
    getComplete: () => createDeepSeekComplete(process.env.DEEPSEEK_API_KEY ?? ""),
  });
}
