"use client";
// 设置面板（右边）：外观（跟随系统 / 深色 / 浅色）、语言和地区（4 种）、关于（网站介绍、数据来源、致谢）。
// 改了马上生效，并记在这个浏览器里（settings-store.ts）。三个模式都能打开。
import type { ReactNode } from "react";
import { useT } from "../i18n/use-t";
import type { MessageKey } from "../i18n/messages-en";
import { Caveat, PanelShell } from "../panels/panel-shell";
import { LOCALES, updateSettings, useSettings, type ThemeChoice } from "./settings-store";

const THEMES: Array<{ id: ThemeChoice; icon: string }> = [
  { id: "system", icon: "M4 5h16v11H4zM9 20h6m-3-4v4" },
  { id: "dark", icon: "M20 14.5A8 8 0 1 1 9.5 4a6.500 6.500 0 0 0 10.500 10.500Z" },
  { id: "light", icon: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-5v2m0 14v2M3 12h2m14 0h2M5.600 5.600 7 7m10 10 1.400 1.400M5.600 18.400 7 17M17 7l1.400-1.400" },
];

/** 数据来源：名字是数据集 / 机构的正式名称，不翻译；说明文字翻译。 */
const DATA_SOURCES: Array<{ name: string; description: MessageKey }> = [
  { name: "NASA LRO LOLA", description: "about.data.lola" },
  { name: "NASA SVS CGI Moon Kit (LROC WAC)", description: "about.data.color" },
  { name: "NASA Moon Trek · LROC Team / ASU", description: "about.data.trek" },
  { name: "IAU / USGS Gazetteer of Planetary Nomenclature", description: "about.data.names" },
  { name: "Ephemeris · NASA JPL Horizons", description: "about.data.ephemeris" },
  { name: "NASA Blue Marble", description: "about.data.earth" },
  { name: "NASA / SDO AIA", description: "about.data.sun" },
];

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const t = useT();
  const { theme, locale } = useSettings();

  return (
    <PanelShell title={t("tool.settings.label")} onClose={onClose} side="right">
      <Section title={t("settings.appearance")}>
        <div role="radiogroup" aria-label={t("settings.appearance")} className="grid grid-cols-3 gap-1 rounded-2xl border border-white/10 bg-white/[0.04] p-1">
          {THEMES.map((option) => {
            const active = theme === option.id;
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => updateSettings({ theme: option.id })}
                className={`flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-[11px] font-medium transition ${active ? "bg-lime-300 text-black" : "text-white/70 hover:bg-white/10 hover:text-white"}`}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={option.icon} /></svg>
                <span className="text-center leading-tight">{t(`settings.theme.${option.id}`)}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] leading-snug text-white/50">{t("settings.appearanceNote")}</p>
      </Section>

      <Section title={t("settings.language")}>
        <div role="radiogroup" aria-label={t("settings.language")} className="space-y-1">
          {LOCALES.map((option) => {
            const active = locale === option.id;
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={active}
                lang={option.id}
                onClick={() => updateSettings({ locale: option.id })}
                className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left transition ${active ? "border-lime-300/60 bg-lime-300/10" : "border-white/10 hover:border-white/25 hover:bg-white/5"}`}
              >
                <span className="min-w-0">
                  <span className="block text-sm text-white">{option.name}</span>
                  {option.name !== option.english && <span lang="en" className="block text-[11px] text-white/50">{option.english}</span>}
                </span>
                <span aria-hidden className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border ${active ? "border-lime-300" : "border-white/30"}`}>
                  {active && <span className="h-2 w-2 rounded-full bg-lime-300" />}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] leading-snug text-white/50">{t("settings.languageNote")}</p>
      </Section>

      <Section title={t("settings.about")} last>
        <p className="text-sm leading-relaxed text-white/85">{t("about.intro")}</p>
        <p className="mt-2 text-xs leading-relaxed text-white/60">{t("about.event")}</p>
        <h4 className="mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">{t("about.dataTitle")}</h4>
        <ul className="mt-1.5 space-y-1.5">
          {DATA_SOURCES.map((source) => (
            <li key={source.name} className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2">
              <p lang="en" className="text-xs font-medium text-white">{source.name}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-white/60">{t(source.description)}</p>
            </li>
          ))}
        </ul>
        <h4 className="mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">{t("about.creditsTitle")}</h4>
        <p className="mt-1.5 text-xs leading-relaxed text-white/75">{t("about.credits")}</p>
        <Caveat>{t("about.accuracy")}</Caveat>
      </Section>
    </PanelShell>
  );
}

function Section({ title, last, children }: { title: string; last?: boolean; children: ReactNode }) {
  return (
    <section className={last ? "" : "mb-5 border-b border-white/10 pb-5"}>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-lime-200/90">{title}</h3>
      {children}
    </section>
  );
}
