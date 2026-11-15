"use client";
// Landing Sites 模式：左边是预设点位清单（真实着陆过的任务 + 南极地名），点一个，地球仪转过去，右边讲解并给出这个位置的数据。
import { useEffect, useState } from "react";
import { usePointAnalysis } from "../analysis/use-point-analysis";
import type { SuitabilityWeights } from "../map-layers";
import type { LatLon } from "../moon-frames";
import { PanelShell } from "../panels/panel-shell";
import { SiteReport } from "../panels/site-report";
import { usePointApi } from "../point-api/use-point-api";
import { loadPresetSites, type SiteEntry } from "./preset-sites";

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
  onSelect: (site: SiteEntry) => void;
  onCloseDetail: () => void;
  timeMs: number;
  weights: SuitabilityWeights;
  onStandHere: (point: LatLon) => void;
}

export function LandingSitesMode({ state, selectedId, onSelect, onCloseDetail, timeMs, weights, onStandHere }: LandingSitesModeProps) {
  const sites = state.status === "ready" ? state.sites : [];
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
        <span className="block truncate whitespace-nowrap text-sm font-semibold">{site.label}</span>
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
      <nav aria-label="Lunar landing sites" className="absolute left-4 right-4 top-32 z-20 sm:right-auto sm:top-24 sm:w-[17rem]">
        <div className="rounded-2xl border border-white/10 bg-[#0b0f17]/90 p-2 shadow-2xl shadow-black/60 lunar-glass backdrop-blur-xl">
          <h2 className="hidden px-2 pb-2 pt-1 text-sm font-semibold uppercase tracking-[0.18em] text-lime-200/90 sm:block">Landing sites</h2>
          {state.status === "loading" && <p role="status" className="px-2 py-2 text-xs text-slate-400">Loading landing sites…</p>}
          {state.status === "error" && <p role="alert" className="px-2 py-2 text-xs text-amber-200">The landing-site list could not be loaded. Check the connection and reload.</p>}
          <ul className="flex gap-1.5 overflow-x-auto sm:max-h-[calc(100dvh-16rem)] sm:flex-col sm:overflow-y-auto sm:overflow-x-visible">
            {missions.length > 0 && groupHeading("Missions")}
            {missions.map(renderSite)}
            {places.length > 0 && groupHeading("Near the south pole")}
            {places.map(renderSite)}
          </ul>
          {state.status === "ready" && <p className="hidden px-2 pt-2 text-[10px] leading-snug text-slate-500 sm:block">Positions: NASA, LROC and IAU data. Open a site to see its exact source.</p>}
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
  return (
    <PanelShell title={site.label} onClose={onClose} side="right" noRail mobileTop="top-56">
      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">{heading}</p>
      {site.name !== site.label && <p className="mt-0.5 text-xs text-slate-500">{site.name}</p>}
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
