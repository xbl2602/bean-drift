"use client";
// 顶部的模式条（样式参照一条简洁的胶囊导航）：
//   [Lunar Quest 标志 + 名字（名字宽屏才显示）] · 三个模式（当前的那个是浅色小胶囊 + 绿点）| Ask AI（快捷键 /）· 教程（?）· 设置（齿轮）
// 鼠标停在任何一个按钮上，下面会弹出一张小卡片，一句话说明它是干什么的；手机没有悬停，靠底部的提示条说明。
import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { useT } from "../i18n/use-t";
import { LunarQuestMark, ToolIcon } from "../menu/tool-menu";
import { toolInfo } from "../menu/tools";
import { APP_MODES, type AppMode } from "./app-modes";

const TUTORIAL_ICON = "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 13v.01M12 13a2.5 2.5 0 1 0-2.5-2.5";

interface ModeSwitchProps {
  mode: AppMode;
  onChange: (mode: AppMode) => void;
  tutorialOpen: boolean;
  aiOpen: boolean;
  settingsOpen: boolean;
  onTutorial: () => void;
  onAi: () => void;
  onSettings: () => void;
}

export function ModeSwitch({ mode, onChange, tutorialOpen, aiOpen, settingsOpen, onTutorial, onAi, onSettings }: ModeSwitchProps) {
  useAskShortcut(aiOpen, onAi);
  const t = useT();
  const ai = toolInfo("ai");
  const settings = toolInfo("settings");
  return (
    <div className="absolute left-21 top-4 z-30 sm:left-24 sm:top-6 lg:left-1/2 lg:-translate-x-1/2">
      <div className="flex items-center gap-0.5 rounded-full border border-white/10 bg-[#0b1018]/85 p-1 shadow-2xl shadow-black/50 lunar-glass backdrop-blur-xl sm:gap-1 sm:p-1.5">
        {/* 网站标志和名字：标志一直显示，名字在宽屏（lg 以上）才显示，手机上放不下 */}
        <Link href="/" aria-label="Lunar Quest — return to landing page" title="Return to landing page" className="hidden shrink-0 items-center gap-2.5 rounded-full pl-1 pr-1 transition sm:flex hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200 sm:pl-2 sm:pr-2.5 lg:pr-3">
          <LunarQuestMark className="h-5 w-5 sm:h-6 sm:w-6" />
          <span className="hidden whitespace-nowrap text-[13px] font-light uppercase tracking-[0.32em] text-white/90 lg:inline">Lunar Quest</span>
        </Link>
        <div role="radiogroup" aria-label="Lunar Quest" data-tour="modes" className="flex items-center gap-0.5 sm:gap-1">
          {APP_MODES.map((item) => {
            const active = mode === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={t(`mode.${item.id}.label`)}
                aria-describedby={`mode-hint-${item.id}`}
                onClick={() => onChange(item.id)}
                className={`group relative flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-1.5 text-xs transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200 sm:px-3.5 sm:py-2 sm:text-[13px] ${active ? "bg-white/10 font-semibold text-white" : "font-medium text-slate-400 hover:text-white"}`}
              >
                {active && <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-lime-300" />}
                <span className="lg:hidden">{t(`mode.${item.id}.short`)}</span>
                <span className="hidden lg:inline">{t(`mode.${item.id}.label`)}</span>
                <HoverCard id={`mode-hint-${item.id}`} title={t(`mode.${item.id}.label`)}>{t(`mode.${item.id}.hint`)}</HoverCard>
              </button>
            );
          })}
        </div>
        <span aria-hidden="true" className="mx-0.5 h-5 w-px shrink-0 bg-white/15 sm:mx-1.5" />
        <button
          type="button"
          data-tour="ai"
          aria-label={t("tool.ai.label")}
          aria-pressed={aiOpen}
          aria-keyshortcuts="/"
          aria-describedby="mode-hint-ai"
          onClick={onAi}
          className={`group relative flex items-center gap-2 whitespace-nowrap rounded-full border p-1.5 text-[13px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200 lg:py-1 lg:pl-3 lg:pr-1 ${aiOpen ? "border-lime-300/40 bg-lime-300/10 text-lime-200" : "border-white/10 bg-white/[0.03] text-white hover:bg-white/10"}`}
        >
          <ToolIcon path={ai.icon} className="h-4 w-4" />
          <span className="hidden lg:inline">{t("bar.askAi")}</span>
          <kbd aria-hidden="true" className="hidden h-6 w-6 place-items-center rounded-full bg-white/10 font-sans text-[11px] font-medium text-slate-300 lg:grid">/</kbd>
          <HoverCard id="mode-hint-ai" title={t("tool.ai.label")} align="right">{t("tool.ai.hint")} · {t("bar.aiMore")}</HoverCard>
        </button>
        <button
          type="button"
          data-tour="tutorial"
          aria-label={t("tool.tutorial.label")}
          aria-pressed={tutorialOpen}
          aria-describedby="mode-hint-tutorial"
          onClick={onTutorial}
          className={`group relative grid h-8 w-8 shrink-0 place-items-center rounded-full transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200 sm:h-9 sm:w-9 ${tutorialOpen ? "bg-white/10 text-lime-200" : "text-slate-400 hover:bg-white/10 hover:text-white"}`}
        >
          <ToolIcon path={TUTORIAL_ICON} className="h-[18px] w-[18px]" />
          <HoverCard id="mode-hint-tutorial" title={t("tool.tutorial.label")} align="right">{t("tool.tutorial.hint")}</HoverCard>
        </button>
        <button
          type="button"
          data-tour="settings"
          aria-label={t("tool.settings.label")}
          aria-pressed={settingsOpen}
          aria-describedby="mode-hint-settings"
          onClick={onSettings}
          className={`group relative grid h-8 w-8 shrink-0 place-items-center rounded-full transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-200 sm:h-9 sm:w-9 ${settingsOpen ? "bg-white/10 text-lime-200" : "text-slate-400 hover:bg-white/10 hover:text-white"}`}
        >
          <ToolIcon path={settings.icon} className="h-[18px] w-[18px]" />
          <HoverCard id="mode-hint-settings" title={t("tool.settings.label")} align="right">{t("tool.settings.hint")}</HoverCard>
        </button>
      </div>
    </div>
  );
}

/** 悬停 / 键盘聚焦时，在按钮下方弹出的一句话说明。Tailwind 4 的 group-hover 只在有鼠标的设备上生效，手机上不会卡住不消失。 */
function HoverCard({ id, title, align = "center", children }: { id: string; title: string; align?: "center" | "right"; children: ReactNode }) {
  const position = align === "right" ? "right-0" : "left-1/2 -translate-x-1/2";
  return (
    <span id={id} role="tooltip" className={`pointer-events-none absolute top-full z-40 mt-3 hidden w-60 rounded-xl border border-white/10 bg-[#0b111b]/95 px-3.5 py-3 text-left opacity-0 shadow-2xl shadow-black/60 backdrop-blur-xl transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 sm:block ${position}`}>
      <span className="block text-xs font-semibold normal-case tracking-normal text-white">{title}</span>
      <span className="mt-1 block whitespace-normal text-[11px] font-normal normal-case leading-snug tracking-normal text-slate-400">{children}</span>
    </span>
  );
}

/** 按 / 打开 AI（正在输入框里打字时不抢这个键；已经打开就不再切换）。 */
function useAskShortcut(aiOpen: boolean, openAi: () => void) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey || aiOpen) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      event.preventDefault();
      openAi();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aiOpen, openAi]);
}
