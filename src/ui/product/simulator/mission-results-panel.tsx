"use client";
// 模拟结果（右边的宽面板），分三页：基地位置的数据、任务进程（图表 + 发生了什么）、表现（得分、关键数字、建议）。
import { useState } from "react";
import { usePointAnalysis } from "../analysis/use-point-analysis";
import { useLocale, useT } from "../i18n/use-t";
import type { SuitabilityWeights } from "../map-layers";
import type { LatLon } from "../moon-frames";
import { PanelButton, PanelShell } from "../panels/panel-shell";
import { SiteReport } from "../panels/site-report";
import { usePointApi } from "../point-api/use-point-api";
import { downloadLocationData, downloadMissionResult } from "./mission-download";
import { formatUtc, missionDay } from "./mission-format";
import { MissionPerformance } from "./mission-performance";
import { MissionProgressChart } from "./mission-progress-chart";
import type { MissionEventKind } from "./mission-sim";
import type { MissionRun } from "./use-mission-run";

type Tab = "site" | "progress" | "performance";
const TABS: Tab[] = ["performance", "progress", "site"]; // 按重要性：先看任务表现，再看过程，最后看基地位置数据
const OUTCOME_STYLE = { success: "border-lime-300/40 bg-lime-300/10 text-lime-200", partial: "border-amber-300/40 bg-amber-300/10 text-amber-200", failed: "border-red-300/40 bg-red-400/10 text-red-200" } as const;
const EVENT_DOT: Record<MissionEventKind, string> = {
  landing: "bg-white", end: "bg-white", sunset: "bg-slate-400", sunrise: "bg-amber-300", "contact-lost": "bg-slate-400", "contact-back": "bg-sky-400",
  hibernate: "bg-slate-300", wake: "bg-lime-300", "battery-low": "bg-amber-500", "power-lost": "bg-red-400",
};
const MAX_EVENTS_SHOWN = 60;

interface MissionResultsPanelProps {
  run: MissionRun;
  mapTimeMs: number;
  onTimeChange: (timeMs: number) => void;
  weights: SuitabilityWeights;
  onStandHere: (point: LatLon) => void;
  onEdit: () => void;
}

export function MissionResultsPanel({ run, mapTimeMs, onTimeChange, weights, onStandHere, onEdit }: MissionResultsPanelProps) {
  const t = useT();
  const locale = useLocale();
  const [tab, setTab] = useState<Tab>("performance");
  const { result } = run;

  return (
    <PanelShell title={t("sim.results")} onClose={onEdit} side="right" fill noRail mobileTop="top-32">
      <div className="shrink-0 px-4">
        <div className={`rounded-xl border px-3 py-2 ${OUTCOME_STYLE[result.outcome]}`}>
          <p className="text-sm font-semibold">{t(`sim.outcome.${result.outcome}`)} · {result.score}/100</p>
          <p className="mt-0.5 truncate text-[11px] opacity-80">
            {t(`sim.type.${run.config.type}`)} · {run.point.label} · {run.config.durationDays === 365 ? t("sim.oneYear") : t("sim.days", { n: run.config.durationDays })}
          </p>
          {result.failedAtMs !== null && <p className="mt-0.5 text-[11px]">{t("sim.failedAt", { day: missionDay(result.startMs, result.failedAtMs) })}</p>}
        </div>
        <div role="tablist" className="mt-3 grid grid-cols-3 gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1">
          {TABS.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`truncate rounded-full px-2 py-1.5 text-[11px] font-medium transition ${tab === id ? "bg-lime-300 text-black" : "text-white/70 hover:bg-white/10 hover:text-white"}`}
            >
              {t(`sim.tab.${id}`)}
            </button>
          ))}
        </div>
      </div>

      <div role="tabpanel" className="min-h-0 flex-1 overflow-y-auto px-4 pb-3 pt-3 [scrollbar-color:rgba(255,255,255,0.25)_transparent] [scrollbar-width:thin]">
        {tab === "site" && <BaseLocation run={run} timeMs={mapTimeMs} weights={weights} onStandHere={onStandHere} />}
        {tab === "progress" && (
          <>
            <MissionProgressChart result={result} mapTimeMs={mapTimeMs} onTimeChange={onTimeChange} />
            <h3 className="mt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">{t("sim.events")}</h3>
            <ol className="mt-1.5 space-y-0.5">
              {result.events.slice(0, MAX_EVENTS_SHOWN).map((event, index) => (
                <li key={`${event.timeMs}-${event.kind}-${index}`}>
                  <button type="button" onClick={() => onTimeChange(event.timeMs)} className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-white/5">
                    <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${EVENT_DOT[event.kind]}`} />
                    <span className="min-w-0">
                      <span className="block text-xs text-white/90">{t(`sim.event.${event.kind}`)}</span>
                      <span className="block text-[10px] text-white/45">{t("sim.day", { n: missionDay(result.startMs, event.timeMs) })} · {formatUtc(locale, event.timeMs)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
            {result.events.length > MAX_EVENTS_SHOWN && <p className="mt-1 text-[11px] text-white/45">{t("sim.moreEvents", { n: MAX_EVENTS_SHOWN })}</p>}
          </>
        )}
        {tab === "performance" && <MissionPerformance result={result} />}
      </div>

      <div className="flex shrink-0 gap-2 border-t border-white/10 px-4 py-3">
        <PanelButton primary onClick={() => downloadMissionResult(run)}>{t("sim.download")}</PanelButton>
        <PanelButton onClick={onEdit}>{t("sim.edit")}</PanelButton>
      </div>
    </PanelShell>
  );
}

function BaseLocation({ run, timeMs, weights, onStandHere }: { run: MissionRun; timeMs: number; weights: SuitabilityWeights; onStandHere: (point: LatLon) => void }) {
  const t = useT();
  const analysis = usePointAnalysis(run.point, timeMs, weights);
  const pointApi = usePointApi(run.point, timeMs);
  const ready = analysis !== null && analysis !== "error";
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-lime-300">{t("sim.locationData")}</p>
      <h3 className="mt-1 truncate text-base font-semibold">{run.point.label}</h3>
      <SiteReport
        point={run.point}
        name={run.point.label}
        timeMs={timeMs}
        analysis={analysis}
        pointApi={pointApi}
        onStandHere={() => onStandHere(run.point)}
        extraActions={<PanelButton disabled={!ready} onClick={() => ready && downloadLocationData(run.point, timeMs, analysis, pointApi)}>Download data</PanelButton>}
      />
    </div>
  );
}
