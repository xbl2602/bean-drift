"use client";
// 左上角的工具按钮：点开弹出工具清单（教程、AI 工具，然后按三类分组）。按钮本身就是 Lunar Quest 标志。工具定义在 tools.ts。
import { useEffect, useRef, useState } from "react";
import { CATEGORY_LABELS, TOOLS, type ToolId } from "./tools";

interface ToolMenuProps {
  activeTool: ToolId | null;
  onSelect: (tool: ToolId) => void;
}

export function ToolIcon({ path, className = "h-5 w-5" }: { path: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}

export function ToolMenu({ activeTool, onSelect }: ToolMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", close);
    };
  }, [open]);

  const groups = (["top", "explore", "science", "evaluate"] as const).map((category) => ({ category, tools: TOOLS.filter((tool) => tool.category === category) }));

  return (
    <div ref={rootRef} className="absolute left-4 top-4 z-30 sm:left-6 sm:top-6">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Lunar Quest: open tools"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-3 rounded-2xl border px-3.5 py-2.5 text-left text-white shadow-lg shadow-black/40 backdrop-blur-md transition hover:bg-black/75 ${open ? "border-lime-300/40 bg-black/75" : "border-white/10 bg-black/55"}`}
      >
        <LunarQuestMark />
        <span className="hidden sm:block">
          <span className="block text-[15px] font-bold uppercase leading-none tracking-[0.34em]">Lunar Quest</span>
          <span className="mt-1.5 block font-mono text-[9px] font-medium uppercase leading-none tracking-[0.24em] text-slate-400">Lunar Exploration Platform</span>
        </span>
      </button>

      {open && (
        <div role="menu" className="mt-2 max-h-[calc(100dvh-7rem)] w-72 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border border-white/10 bg-[#0b0f17]/92 [scrollbar-color:rgba(255,255,255,0.25)_transparent] [scrollbar-width:thin] p-1.5 shadow-2xl shadow-black/60 backdrop-blur-xl">
          {groups.map(({ category, tools }) => (
            <div key={category} role="group" aria-label={category === "top" ? "Start here" : CATEGORY_LABELS[category]} className={category === "top" ? "" : "mt-1 border-t border-white/10 pt-1"}>
              {category !== "top" && <p className="px-3 pb-1 pt-2 font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-slate-400">{CATEGORY_LABELS[category]}</p>}
              {tools.map((tool) => (
                <button
                  key={tool.id}
                  type="button"
                  role="menuitem"
                  title={tool.hint}
                  onClick={() => {
                    onSelect(tool.id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-white/10 ${activeTool === tool.id ? "bg-white/10" : ""}`}
                >
                  <span className="text-lime-300"><ToolIcon path={tool.icon} /></span>
                  <span className="min-w-0 truncate text-[12px] font-semibold uppercase tracking-[0.16em] text-white/90">{tool.label}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** 标志图形：一个圆，下半边是亮的（像被照亮一半的月亮）。用代码画，不依赖外部图片。 */
function LunarQuestMark() {
  return (
    <svg viewBox="0 0 40 40" className="h-9 w-9 shrink-0" aria-hidden="true">
      <circle cx="20" cy="20" r="17" fill="#0a0d13" stroke="#f3efe6" strokeWidth="3" />
      <path d="M4.500 21a15.500 15.500 0 0 0 31 0Z" fill="#f3efe6" />
    </svg>
  );
}
