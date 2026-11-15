"use client";
// AI Tools 的聊天框：打开时助手先一个字一个字地打出开场白，下面出现几个示例问题；
// 用户在底部输入框打字，Enter 发送（Shift+Enter 换行）。回答也以打字的方式出现（很快），
// 回答打完字后换成带格式的文字（AnswerText），并在下面画出数据图（AnswerVisuals：天空图、时间窗、附近地名图）——
// 这两个是 louis068 的 agent-search 功能模块对外的界面组件，和原来的 LunarSearch 一样直接用，不改它们。
// 回答下面标明有没有用月面数据工具核对过（只有地名查找 lunar_gazetteer 不算"核对过"，见 SHARED_INTERFACES 第 6 节），可以展开看原始数据。
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { AnswerText } from "@/features/agent-search/ui/answer-text";
import { AnswerVisuals } from "@/features/agent-search/ui/answer-visuals";
import type { SelectedLunarLocation } from "@/features/agent-search/ui/lunar-search";
import { ToolIcon } from "../../menu/tool-menu";
import { toolInfo } from "../../menu/tools";
import type { AgentSource } from "./agent-client";
import { clearChat, markGreeted, sendMessage, stopMessage, useChat, type ChatMessage } from "./chat-store";

const EXAMPLES = [
  { label: "What's near 18°N 82.8°E?", question: "At 18.00°N 82.80°E, which named craters and landmarks are nearby? Show their positions and distances, and explain what this schematic cannot tell me." },
  { label: "Sunniest spot at the south pole?", question: "Find south polar sites south of -85° latitude with slope under 5° and the shortest darkness." },
  { label: "Apollo 11 vs south pole", question: "Compare sunlight and Earth visibility at Apollo 11 and the lunar south pole on 2030-01-01T12:00:00Z." },
  { label: "Which landing sites exist?", question: "List the lunar landing site presets and their coordinates." },
  { label: "Two weeks at the south pole", question: "Show the sunlight and Earth visibility windows at the lunar south pole from 2030-01-01T00:00:00Z to 2030-01-15T00:00:00Z." },
];
const TOOL_LABELS: Record<string, string> = {
  lunar_gazetteer: "Nearby named landmarks (IAU list)",
  list_presets: "Landing site list",
  get_point_conditions: "Conditions at a point",
  compare_points: "Site comparison",
  get_point_timeline: "Sunlight & Earth timeline",
  compare_dates: "Date comparison",
  find_sites: "Site finder",
};
const GREETING_CHAR_MS = 26;
const ANSWER_MAX_TYPING_MS = 1400;
/** 已经打过字的消息，再次打开面板时直接显示全文。 */
const typedIds = new Set<number>();

export function AiChat({ onSelectLocation }: { onSelectLocation?: (loc: SelectedLunarLocation) => void }) {
  const { messages, pending, greeted } = useChat();
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState("");
  const [typingTick, setTypingTick] = useState(0);
  const hasQuestions = messages.some((message) => message.role === "user");

  // 有新消息、打字往前推进时，滚到最底下
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages.length, pending, typingTick]);
  // 有鼠标的设备上，打开就把光标放进输入框（手机上不自动弹键盘）
  useEffect(() => {
    if (window.matchMedia("(pointer: fine)").matches) inputRef.current?.focus();
  }, []);

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (!draft.trim() || pending) return;
    void sendMessage(draft);
    setDraft("");
  };
  const pickExample = (question: string) => {
    setDraft(question);
    inputRef.current?.focus();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={listRef} role="log" aria-live="polite" aria-label="Conversation with the lunar assistant" className="lunar-rail min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-3 pt-1">
        {messages.map((message, index) => (
          <MessageRow
            key={message.id}
            message={message}
            animate={message.role === "assistant" && (message.kind === "greeting" ? !greeted : index === messages.length - 1 && !typedIds.has(message.id))}
            onProgress={() => setTypingTick((tick) => tick + 1)}
            onTyped={() => { typedIds.add(message.id); if (message.role === "assistant" && message.kind === "greeting") markGreeted(); }}
            onQuestion={pickExample}
            onSelectLocation={onSelectLocation}
          />
        ))}
        {greeted && !hasQuestions && (
          <div className="flex flex-wrap gap-1.5 pl-9" aria-label="Example questions">
            {EXAMPLES.map((example) => (
              <button key={example.label} type="button" onClick={() => pickExample(example.question)} className="rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-left text-[11px] text-slate-200 transition hover:border-lime-300/40 hover:bg-lime-300/10 hover:text-white">
                {example.label}
              </button>
            ))}
          </div>
        )}
        {pending && <AssistantBubble><TypingDots /></AssistantBubble>}
      </div>

      <form onSubmit={submit} className="shrink-0 border-t border-white/10 px-3 pb-3 pt-3">
        <div className="flex items-end gap-2 rounded-2xl border border-white/12 bg-black/30 py-1.5 pl-3.5 pr-1.5 transition focus-within:border-lime-300/40">
          <label htmlFor="ai-chat-input" className="sr-only">Ask about the Moon</label>
          <textarea
            id="ai-chat-input"
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) submit(event);
            }}
            rows={1}
            maxLength={2000}
            placeholder="Ask about the Moon…"
            className="max-h-28 min-h-[2.25rem] flex-1 resize-none bg-transparent py-2 text-[13px] leading-snug text-white outline-none [field-sizing:content] placeholder:text-slate-500"
          />
          {pending ? (
            <button type="button" onClick={stopMessage} aria-label="Stop" title="Stop" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/15 text-white/80 hover:bg-white/10">
              <span className="h-3 w-3 rounded-[3px] bg-current" />
            </button>
          ) : (
            <button type="submit" aria-label="Send" title="Send (Enter)" disabled={!draft.trim()} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-lime-300 text-black transition hover:bg-lime-200 disabled:bg-white/10 disabled:text-white/30">
              <ToolIcon path="M12 19V5m0 0-6 6m6-6 6 6" className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 px-1 text-[10px] text-slate-500">
          <span>Enter to send · Shift+Enter for a new line</span>
          {hasQuestions && <button type="button" onClick={() => { typedIds.clear(); clearChat(); setDraft(""); }} className="text-slate-400 underline-offset-2 hover:text-white hover:underline">New chat</button>}
        </div>
      </form>
    </div>
  );
}

function MessageRow({ message, animate, onProgress, onTyped, onQuestion, onSelectLocation }: { message: ChatMessage; animate: boolean; onProgress: () => void; onTyped: () => void; onQuestion: (question: string) => void; onSelectLocation?: (loc: SelectedLunarLocation) => void }) {
  const [typed, setTyped] = useState(!animate);
  if (message.role === "user") {
    return (
      <div className="flex justify-end pl-10">
        <p className="whitespace-pre-wrap break-words rounded-2xl rounded-tr-md bg-lime-300 px-3.5 py-2 text-[13px] leading-snug text-[#11180a]">{message.text}</p>
      </div>
    );
  }
  if (message.kind === "error") {
    return (
      <AssistantBubble tone="error">
        <p>{message.text}</p>
        <button type="button" onClick={() => void sendMessage(message.retryText)} className="mt-2 rounded-full border border-amber-200/30 px-2.5 py-1 text-[11px] text-amber-100 hover:bg-amber-200/10">Send again</button>
      </AssistantBubble>
    );
  }
  const charMs = message.kind === "greeting" ? GREETING_CHAR_MS : Math.min(12, ANSWER_MAX_TYPING_MS / Math.max(message.text.length, 1));
  return (
    <AssistantBubble>
      {message.kind === "answer" && typed ? (
        <>
          <div className="break-words [&_h4]:mb-1 [&_h4]:mt-3 [&_h4]:font-semibold [&_h4]:text-white [&_li]:my-0.5 [&_p+p]:mt-2 [&_strong]:font-semibold [&_strong]:text-white [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-4"><AnswerText text={message.text} /></div>
          <div className="text-slate-200"><AnswerVisuals sources={message.sources} onQuestion={onQuestion} onSelectLocation={onSelectLocation} /></div>
        </>
      ) : (
        <TypedText text={message.text} animate={animate} charMs={charMs} onProgress={onProgress} onDone={() => { setTyped(true); onTyped(); }} />
      )}
      {message.kind === "answer" && <SourceNote sources={message.sources} />}
    </AssistantBubble>
  );
}

function AssistantBubble({ children, tone = "normal" }: { children: ReactNode; tone?: "normal" | "error" }) {
  const ai = toolInfo("ai");
  return (
    <div className="flex items-start gap-2 pr-6">
      <span aria-hidden="true" className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-lime-300/30 bg-lime-300/10 text-lime-200">
        <ToolIcon path={ai.icon} className="h-3.5 w-3.5" />
      </span>
      <div className={`min-w-0 rounded-2xl rounded-tl-md border px-3.5 py-2.5 text-[13px] leading-relaxed ${tone === "error" ? "border-amber-200/20 bg-amber-200/[0.06] text-amber-100/90" : "border-white/10 bg-white/[0.05] text-slate-100"}`}>
        {children}
      </div>
    </div>
  );
}

/** 一个字一个字地显示文字；用户设置了"减少动画"就直接显示全文。回答是纯文本，只当文字显示。 */
function TypedText({ text, animate, charMs, onProgress, onDone }: { text: string; animate: boolean; charMs: number; onProgress: () => void; onDone: () => void }) {
  const [shown, setShown] = useState(animate ? 0 : text.length);
  const doneRef = useRef(onDone);
  const progressRef = useRef(onProgress);
  doneRef.current = onDone;
  progressRef.current = onProgress;

  useEffect(() => {
    if (!animate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(text.length);
      doneRef.current();
      return;
    }
    const startMs = performance.now();
    let frame = requestAnimationFrame(function step(nowMs) {
      const count = Math.min(text.length, Math.floor((nowMs - startMs) / charMs));
      setShown(count);
      progressRef.current();
      if (count < text.length) frame = requestAnimationFrame(step);
      else doneRef.current();
    });
    return () => cancelAnimationFrame(frame);
  }, [animate, text, charMs]);

  const typing = shown < text.length;
  return (
    <p className="whitespace-pre-wrap break-words">
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">{text.slice(0, shown)}{typing && <span className="ml-px inline-block h-3.5 w-[2px] translate-y-0.5 animate-pulse bg-lime-300" />}</span>
    </p>
  );
}

function SourceNote({ sources }: { sources: AgentSource[] }) {
  if (sources.length === 0) {
    return <p className="mt-2 text-[10px] text-slate-500">Not checked against Lunar Quest data. Treat it as a general answer.</p>;
  }
  // 地名查找只是查了 IAU 地名表，没有算光照或通信，不能标成"核对过"
  const calculated = sources.filter((source) => source.tool !== "lunar_gazetteer").length;
  return (
    <details className="group mt-2 text-[10px]">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full border border-lime-300/25 bg-lime-300/[0.07] px-2 py-0.5 text-lime-200/90 hover:bg-lime-300/15">
        <ToolIcon path="m5 12 4 4L19 6" className="h-3 w-3" />
        {calculated > 0 ? `Checked with ${calculated} lunar data ${calculated === 1 ? "tool" : "tools"}` : "Landmark names only · no sunlight or Earth data calculated"}
        <span className="text-lime-200/60 group-open:hidden">· show</span>
      </summary>
      <div className="mt-2 space-y-1.5">
        {sources.map((source, index) => (
          <details key={`${source.tool}-${index}`} className="rounded-lg border border-white/10 bg-black/25">
            <summary className="cursor-pointer px-2 py-1.5 text-slate-300">{TOOL_LABELS[source.tool] ?? "Lunar data tool"} <span className="text-slate-500">#{index + 1}</span></summary>
            <pre tabIndex={0} className="max-h-40 overflow-auto border-t border-white/10 px-2 py-1.5 font-mono text-[9px] leading-snug text-slate-400">{JSON.stringify({ input: source.input, result: source.result }, null, 2)}</pre>
          </details>
        ))}
      </div>
    </details>
  );
}

function TypingDots() {
  return (
    <span className="flex h-4 items-center gap-1" role="status" aria-label="The assistant is checking lunar data">
      {[0, 150, 300].map((delay) => <span key={delay} className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-300/80" style={{ animationDelay: `${delay}ms` }} />)}
    </span>
  );
}
