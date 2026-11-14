"use client";
import { useEffect, useRef, useState } from "react";
import { CATEGORY_LABELS, TOOLS, type ToolCategory, type ToolId } from "./tools";

interface ToolMenuProps {
  activeTool: ToolId | null;
  onSelect: (tool: ToolId) => void;
  onHome: () => void;
  onGroupOpen: () => void;
}
type GroupId = Exclude<ToolCategory, "top">;
const GROUPS: Array<{ id: GroupId; short: string; icon: string }> = [
  { id: "explore", short: "Explore", icon: "m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Zm6-3v15m6-12v15" },
  { id: "science", short: "Science", icon: "M9 3h6m-5 0v6l-6 10a1.3 1.3 0 0 0 1 2h14a1.3 1.3 0 0 0 1-2L14 9V3M8 14h8" },
  { id: "evaluate", short: "Evaluate", icon: "M5 20V10m7 10V4m7 16v-7M3 20h18" },
];
export function ToolIcon({ path, className = "h-5 w-5" }: { path: string; className?: string }) {
  return <svg viewBox="0 0 24 24" className={`shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>;
}

export function ToolMenu({ activeTool, onSelect, onHome, onGroupOpen }: ToolMenuProps) {
  const [open, setOpen] = useState<GroupId | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !rootRef.current?.contains(event.target as Node)) setOpen(null);
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", close);
    return () => { window.removeEventListener("pointerdown", close); window.removeEventListener("keydown", close); };
  }, [open]);
  useEffect(() => { if (activeTool) setOpen(null); }, [activeTool]);
  const choose = (tool: ToolId) => { onSelect(tool); setOpen(null); };
  const buttonStyle = (selected: boolean) => `flex min-h-14 w-14 flex-col items-center justify-center gap-1 rounded-xl transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200 ${selected ? "bg-lime-300 text-[#11180a] shadow-lg shadow-lime-300/10" : "text-slate-300 hover:bg-white/10 hover:text-white"}`;
  return (
    <div ref={rootRef}>
      <nav aria-label="Explorer navigation" className="lunar-rail absolute left-3 top-4 z-30 max-h-[calc(100dvh-8rem)] overflow-y-auto rounded-2xl border border-white/10 bg-[#090e15]/90 p-1.5 shadow-2xl shadow-black/40 lunar-glass backdrop-blur-xl sm:left-5 sm:top-6">
        <button type="button" data-tour="home" aria-label="Home: reset explorer view" title="Home · return to the initial view" onClick={() => { setOpen(null); onHome(); }} className={buttonStyle(activeTool === null && open === null)}>
          <LunarQuestMark /><span className="text-[9px] font-semibold">Home</span>
        </button>
        <div className="my-2 h-px bg-white/10" />
        {TOOLS.filter((tool) => tool.category === "top").map((tool) => <button key={tool.id} type="button" data-tour={tool.id} aria-label={tool.label} title={tool.label} onClick={() => choose(tool.id)} className={buttonStyle(activeTool === tool.id)}>
          <ToolIcon path={tool.icon} /><span className="text-[9px] font-medium">{tool.id === "ai" ? "AI Tools" : tool.label}</span>
        </button>)}
        <div className="my-2 h-px bg-white/10" />
        {GROUPS.map((group) => <button key={group.id} type="button" data-tour={group.id} aria-label={CATEGORY_LABELS[group.id]} title={CATEGORY_LABELS[group.id]} aria-expanded={open === group.id} aria-controls="explorer-tool-group" onClick={() => { if (open !== group.id) onGroupOpen(); setOpen((current) => current === group.id ? null : group.id); }} className={buttonStyle(open === group.id || Boolean(activeTool && TOOLS.find((tool) => tool.id === activeTool)?.category === group.id))}>
          <ToolIcon path={group.icon} /><span className="text-[9px] font-medium">{group.short}</span>
        </button>)}
      </nav>
      {open && <div id="explorer-tool-group" className="absolute left-24 top-36 z-30 max-h-[calc(100dvh-15rem)] w-[min(20rem,calc(100vw-7rem))] overflow-y-auto rounded-2xl border border-white/15 bg-[#0b111b]/95 p-2 shadow-2xl shadow-black/60 lunar-glass backdrop-blur-xl sm:top-24">
        <div className="flex items-center justify-between px-2 py-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-lime-200">{CATEGORY_LABELS[open]}</h2>
          <button type="button" aria-label="Close tool group" onClick={() => setOpen(null)} className="rounded-lg p-1 text-white/60 hover:bg-white/10"><ToolIcon path="m6 6 12 12M18 6 6 18" className="h-4 w-4" /></button>
        </div>
        {TOOLS.filter((tool) => tool.category === open).map((tool) => <button key={tool.id} type="button" onClick={() => choose(tool.id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-white/10 focus-visible:outline focus-visible:outline-lime-200 ${activeTool === tool.id ? "bg-lime-300/10" : ""}`}>
          <span className="text-lime-300"><ToolIcon path={tool.icon} /></span>
          <span className="min-w-0"><span className="block text-xs font-semibold text-white/95">{tool.label}</span><span className="mt-1 block text-[10px] leading-snug text-slate-400">{tool.hint}</span></span>
        </button>)}
      </div>}
    </div>
  );
}
function LunarQuestMark() {
  return <svg viewBox="0 0 40 40" className="h-6 w-6 shrink-0" aria-hidden="true"><circle cx="20" cy="20" r="17" fill="#0a0d13" stroke="#f3efe6" strokeWidth="3" /><path d="M4.500 21a15.500 15.500 0 0 0 31 0Z" fill="#f3efe6" /></svg>;
}
