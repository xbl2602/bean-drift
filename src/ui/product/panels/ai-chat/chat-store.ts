// 聊天记录放在浏览器这一页的内存里（不是服务器）：关掉 AI 面板再打开、切换模式，之前的对话都还在；刷新页面就清空。
// 每条问题都是单独发给 /api/agent 的（接口没有对话历史），所以开场白会提醒用户每次带上地点和日期。
import { useSyncExternalStore } from "react";
import { askAgent, type AgentSource } from "./agent-client";

export type ChatMessage =
  | { id: number; role: "assistant"; kind: "greeting"; text: string }
  | { id: number; role: "user"; text: string }
  | { id: number; role: "assistant"; kind: "answer"; text: string; sources: AgentSource[] }
  | { id: number; role: "assistant"; kind: "error"; text: string; retryText: string };

export interface ChatState {
  messages: ChatMessage[];
  pending: boolean;
  /** 开场白已经打完字了（只在第一次打开时慢慢打出来）。 */
  greeted: boolean;
}

export const GREETING =
  "Hello, explorer! I'm the Lunar Quest assistant. Ask me about sunlight, Earth visibility, slopes or landing sites anywhere on the Moon. Tip: I read each message on its own, so include the place and date every time.";

const CLIENT_TIMEOUT_MS = 30_000;

let state: ChatState = { messages: [{ id: 0, role: "assistant", kind: "greeting", text: GREETING }], pending: false, greeted: false };
let nextId = 1;
let active: AbortController | null = null;
/** 每次"New chat"加一；旧对话里还没回来的回答直接丢掉，不会混进新对话。 */
let generation = 0;
const listeners = new Set<() => void>();

function update(next: Partial<ChatState>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}
function append(message: ChatMessage) {
  update({ messages: [...state.messages, message] });
}

export function useChat(): ChatState {
  return useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    () => state,
    () => state,
  );
}

export function markGreeted() {
  if (!state.greeted) update({ greeted: true });
}

export async function sendMessage(raw: string) {
  const text = raw.trim();
  if (!text || state.pending) return;
  append({ id: nextId++, role: "user", text });
  update({ pending: true, greeted: true });
  const controller = new AbortController();
  const myGeneration = generation;
  active = controller;
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, CLIENT_TIMEOUT_MS);
  try {
    const reply = await askAgent(text, controller.signal);
    if (myGeneration !== generation) return;
    append({ id: nextId++, role: "assistant", kind: "answer", text: reply.answer, sources: reply.sources });
  } catch (cause) {
    if (myGeneration !== generation) return;
    const message = controller.signal.aborted
      ? (timedOut ? "That took too long. Try a more specific question." : "Stopped. Send it again whenever you like.")
      : cause instanceof Error ? cause.message : "Something went wrong. Please try again.";
    append({ id: nextId++, role: "assistant", kind: "error", text: message, retryText: text });
  } finally {
    clearTimeout(timer);
    if (active === controller) { active = null; update({ pending: false }); }
  }
}

export function stopMessage() {
  active?.abort();
}

export function clearChat() {
  generation += 1;
  active?.abort();
  active = null;
  state = { messages: [{ id: nextId++, role: "assistant", kind: "greeting", text: GREETING }], pending: false, greeted: false };
  listeners.forEach((listener) => listener());
}
