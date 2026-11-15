"use client";
// Landing Sites 模式：左边是预设点位清单（真实着陆过的任务 + 南极地名），点一个，地球仪转过去，右边讲解并给出这个位置的数据。
// 先选类别（载人 → 无人 → 全部），选了才列出这一类的点位，可以随时返回重选；载人琥珀色、无人青绿色，地图上的标记同色。
import { useEffect, useState } from "react";
import { useT } from "../i18n/use-t";
import { usePointAnalysis } from "../analysis/use-point-analysis";
import type { SuitabilityWeights } from "../map-layers";
import type { LatLon } from "../moon-frames";
import { PanelShell } from "../panels/panel-shell";
import { SiteReport } from "../panels/site-report";
import { usePointApi } from "../point-api/use-point-api";
import { filterLandingSites, LANDING_KIND_COLORS, loadPresetSites, type LandingFilter, type SiteEntry } from "./preset-sites";

/** 类别选择的顺序：载人在前，然后无人，最后全部。 */
const CATEGORY_ORDER: readonly LandingFilter[] = ["human", "robotic", "all"];

export type LandingSitesState = { status: "loading" } | { status: "ready"; sites: SiteEntry[] } | { status: "error" };

/** enabled=false 时不下载（第一次进入 Landing Sites 模式时才去取预设点位清单）。 */
export function usePresetSites(enabled: boolean): LandingSitesState {
  const [state, setState] = useState<LandingSitesState>({ status: "loading" });
  useEffect(() => {
    if (!enabled || state.status === "ready") return;
    let cancelled = false;
    loadPresetSites().then(
      (sites) => !cancelled && setState({ status: "ready", sites }),
      () => !cancelled && setState({ status: "error" }),
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只在第一次启用时取一次
  }, [enabled]);
  return state;
}

/** 列表里每一项下面那行小字。 */
function siteCaption(site: SiteEntry): string {
  if (site.landedUtc && site.agency) return `${site.landedUtc.slice(0, 4)} · ${site.agency}`;
  return site.kind === "place" ? "Named place · not a landing target" : "Landing site";
}

interface LandingSitesModeProps {
  state: LandingSitesState;
  selectedId: string | null;
  /** null = 还在第 1 步选类别。 */
  category: LandingFilter | null;
  onCategoryChange: (category: LandingFilter | null) => void;
  onSelect: (site: SiteEntry) => void;
  onCloseDetail: () => void;
  timeMs: number;
  weights: SuitabilityWeights;
  onStandHere: (point: LatLon) => void;
}

export function LandingSitesMode({ state, selectedId, category, onCategoryChange, onSelect, onCloseDetail, timeMs, weights, onStandHere }: LandingSitesModeProps) {
  const t = useT();
  const allSites = state.status === "ready" ? state.sites : [];
  const sites = filterLandingSites(allSites, category ?? "all");
  const selected = sites.find((site) => site.id === selectedId) ?? null;
  const missions = sites.filter((site) => site.kind === "landing-site");
  const places = sites.filter((site) => site.kind === "place");
  const renderSite = (site: SiteEntry) => (
    <li key={site.id} className="shrink-0">
      <button
        type="button"
        aria-pressed={site.id === selectedId}
        onClick={() => onSelect(site)}
        className={`w-full rounded-xl border px-3 py-2 text-left transition ${site.id === selectedId ? "border-lime-300/40 bg-lime-300/15" : "border-white/10 bg-white/[0.04] hover:bg-white/10"}`}
      >
        <span className="flex items-center gap-2 whitespace-nowrap text-sm font-semibold">
          {site.crew && <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: LANDING_KIND_COLORS[site.crew] }} />}
          <span className="truncate">{site.label}</span>
        </span>
        <span className="block truncate whitespace-nowrap text-[11px] text-slate-400">{siteCaption(site)}</span>
      </button>
    </li>
  );
  const groupHeading = (text: string) => (
    <li key={text} role="presentation" className="hidden px-2 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 sm:block">
      {text}
    </li>
  );
  return (
    <>
      <nav aria-label={t("landing.title")} className="absolute left-4 right-4 top-32 z-20 sm:right-auto sm:top-24 sm:w-[17rem]">
        <div className="rounded-2xl border border-white/10 bg-[#0b0f17]/90 p-2 shadow-2xl shadow-black/60 lunar-glass backdrop-blur-xl">
          {state.status === "loading" && <p role="status" className="px-2 py-2 text-xs text-slate-400">{t("landing.loading")}</p>}
          {state.status === "error" && <p role="alert" className="px-2 py-2 text-xs text-amber-200">{t("landing.error")}</p>}
          {state.status === "ready" && category === null && (
            <>
              <h2 className="hidden px-2 pb-1 pt-1 text-sm font-semibold uppercase tracking-[0.18em] text-lime-200/90 sm:block">{t("landing.title")}</h2>
              <p className="hidden px-2 pb-2 text-xs text-slate-400 sm:block">{t("landing.choose")}</p>
              <ul className="grid grid-cols-3 gap-1.5 sm:grid-cols-1">
                {CATEGORY_ORDER.map((id) => (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => onCategoryChange(id)}
                      className="flex h-full w-full items-start gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2 text-left transition hover:border-lime-300/40 hover:bg-white/10 sm:px-3 sm:py-2.5"
                    >
                      <span aria-hidden="true" className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={id === "all" ? { background: `linear-gradient(90deg, ${LANDING_KIND_COLORS.human} 50%, ${LANDING_KIND_COLORS.robotic} 50%)` } : { backgroundColor: LANDING_KIND_COLORS[id] }} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-semibold leading-snug text-white sm:text-sm">{t(`landing.cat.${id}`)}</span>
                        <span className="hidden text-[11px] leading-snug text-slate-400 sm:block">{t(`landing.cat.${id}.desc`)}</span>
                        <span className="block text-[10px] text-slate-500">{t("landing.count", { n: filterLandingSites(allSites, id).length })}</span>
                      </span>
                      <svg aria-hidden="true" viewBox="0 0 24 24" className="mt-1 hidden h-4 w-4 shrink-0 text-slate-500 sm:block" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          {state.status === "ready" && category !== null && (
            <>
              <div className="flex items-center gap-2 px-1 pb-2 pt-0.5">
                <button type="button" onClick={() => onCategoryChange(null)} className="flex shrink-0 items-center gap-1 rounded-full border border-white/15 py-1 pl-1.5 pr-2.5 text-[11px] text-white/85 hover:bg-white/10">
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
                  {t("landing.back")}
                </button>
                <h2 className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-lime-200/90">
                  {category !== "all" && <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: LANDING_KIND_COLORS[category] }} />}
                  <span className="truncate">{t(`landing.cat.${category}`)}</span>
                  <span className="shrink-0 text-[10px] font-normal text-slate-500">{sites.length}</span>
                </h2>
              </div>
              <ul className="flex gap-1.5 overflow-x-auto sm:max-h-[calc(100dvh-22rem)] sm:flex-col sm:overflow-y-auto sm:overflow-x-visible">
                {category === "all" && missions.length > 0 && groupHeading(t("landing.missions"))}
                {missions.map(renderSite)}
                {places.length > 0 && groupHeading(t("landing.places"))}
                {places.map(renderSite)}
              </ul>
            </>
          )}
          {state.status === "ready" && <p className="hidden px-2 pt-2 text-[10px] leading-snug text-slate-500 sm:block">{t("landing.sources")}</p>}
        </div>
      </nav>
      {selected && <LandingSiteDetail key={selected.id} site={selected} timeMs={timeMs} weights={weights} onStandHere={onStandHere} onClose={onCloseDetail} />}
    </>
  );
}

function LandingSiteDetail({ site, timeMs, weights, onStandHere, onClose }: { site: SiteEntry; timeMs: number; weights: SuitabilityWeights; onStandHere: (point: LatLon) => void; onClose: () => void }) {
  const analysis = usePointAnalysis(site, timeMs, weights);
  const pointApi = usePointApi(site, timeMs);
  const heading = site.agency && site.landedUtc ? `${site.agency} · landed ${site.landedUtc}` : site.kind === "place" ? "Named place · not a landing target" : "Landing site";
  const crewLabel = site.crew === "human" ? "Crewed" : site.crew === "robotic" ? "Robotic" : null;
  return (
    <PanelShell title={site.label} onClose={onClose} side="right" noRail mobileTop="top-56">
      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">{heading}</p>
      {(crewLabel || site.name !== site.label) && (
        <p className="mt-0.5 text-xs text-slate-500">{[crewLabel, site.name !== site.label ? site.name : null].filter(Boolean).join(" · ")}</p>
      )}
      <p className="mt-3 text-sm leading-relaxed text-slate-200">{site.summary}</p>
      {site.dataNote && <p className="mt-3 rounded-xl border border-[#a8c8d9]/20 bg-[#a8c8d9]/[0.06] px-3 py-2 text-xs leading-relaxed text-[#d3e6ef]">{site.dataNote}</p>}
      <details className="mt-3 text-[11px] leading-snug text-slate-500">
        <summary className="cursor-pointer text-slate-400">Where this position comes from</summary>
        <p className="mt-1">{site.positionSource}</p>
      </details>
      <SiteReport point={site} name={site.label} timeMs={timeMs} analysis={analysis} pointApi={pointApi} onStandHere={() => onStandHere(site)} />
    </PanelShell>
  );
}
