"use client";
// 工具面板的外壳：左侧一块半透明卡片，带标题和关闭按钮。wide = 居中的宽面板（对比表用）。
import type { ReactNode } from "react";

interface PanelShellProps {
  title: string;
  onClose: () => void;
  wide?: boolean;
  /** 默认在左边；right = 右上角视图开关的下方。 */
  side?: "left" | "right";
  children: ReactNode;
}

export function PanelShell({ title, onClose, wide, side, children }: PanelShellProps) {
  const position = wide
    ? "left-24 right-4 top-36 sm:right-6 sm:top-24"
    : side === "right"
      ? "left-24 right-4 top-36 sm:left-auto sm:right-6 sm:top-24 sm:w-[min(22rem,calc(100vw-7rem))]"
      : "left-24 top-36 w-[min(21rem,calc(100vw-7rem))] sm:top-24";
  return (
    <aside className={`absolute z-20 flex ${side === "right" ? "max-h-[min(50dvh,calc(100dvh-13.5rem))] sm:max-h-[calc(100dvh-13.5rem)]" : "max-h-[calc(100dvh-13.5rem)]"} flex-col rounded-2xl border border-white/10 bg-[#0b0f17]/90 text-white shadow-2xl shadow-black/60 lunar-glass backdrop-blur-xl ${position}`}>
      <header className="flex shrink-0 items-center justify-between px-4 pt-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-lime-200/90">{title}</h2>
        <button type="button" onClick={onClose} aria-label={`Close ${title}`} className="rounded-full p-1 text-white/60 hover:bg-white/10 hover:text-white">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-3">{children}</div>
    </aside>
  );
}

/** 面板里的小号说明文字（数据来源、模型注意事项）。 */
export function Caveat({ children }: { children: ReactNode }) {
  return <p className="mt-3 rounded-lg border border-amber-200/15 bg-amber-200/5 px-2.5 py-2 text-[11px] leading-snug text-amber-100/75">{children}</p>;
}

export function PanelButton({ children, onClick, disabled, primary }: { children: ReactNode; onClick: () => void; disabled?: boolean; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${primary ? "bg-lime-300 text-black hover:bg-lime-200" : "border border-white/15 text-white/85 hover:bg-white/10"}`}
    >
      {children}
    </button>
  );
}
