"use client";
// 任务模拟器模式（模式 id 仍是 find-data，保存的"上次模式"不受影响）：
// 左边第 1 步选着陆点（搜索或点地图），第 2 步定任务类型、时长和设备，点"开始模拟"；
// 结果在右边的宽面板，分"基地位置 / 任务进程 / 表现"三页。手机上结果和设置轮流显示（宽屏 lg 以上两个并排）。
import { useEffect, useState } from "react";
import { useT } from "../i18n/use-t";
import type { SuitabilityWeights } from "../map-layers";
import { formatLatLon, type LatLon } from "../moon-frames";
import { SearchPanel, type SearchTarget } from "../panels/search-panel";
import { MissionResultsPanel } from "../simulator/mission-results-panel";
import { MissionSetupForm } from "../simulator/mission-setup-form";
import { defaultConfig, type MissionConfig } from "../simulator/mission-presets";
import { useMissionRun } from "../simulator/use-mission-run";

interface FindDataModeProps {
  target: SearchTarget | null;
  onGoTo: (target: SearchTarget) => void;
  onClear: () => void;
  timeMs: number;
  onTimeChange: (timeMs: number) => void;
  weights: SuitabilityWeights;
  onStandHere: (point: LatLon) => void;
  onCompareLocation: (point: LatLon, name: string) => void;
  /** 右边被别的面板（AI、设置）占着时，结果先藏起来。 */
  resultsHidden: boolean;
  /** 结果面板显示 / 收起时告诉外面（3D 球往左让开）。 */
  onResultsOpenChange: (open: boolean) => void;
}

export function FindDataMode({ target, onGoTo, onClear, timeMs, onTimeChange, weights, onStandHere, onCompareLocation, resultsHidden, onResultsOpenChange }: FindDataModeProps) {
  const t = useT();
  const [config, setConfig] = useState<MissionConfig>(() => defaultConfig("lander", timeMs));
  const { state, start, cancel, reset } = useMissionRun();
  const resultsShown = state.status === "done" && !resultsHidden;
  useEffect(() => onResultsOpenChange(resultsShown), [resultsShown, onResultsOpenChange]);
  useEffect(() => () => onResultsOpenChange(false), [onResultsOpenChange]);
  // 换了着陆点 = 新的计划：旧结果（或还没算完的）作废
  useEffect(() => reset(), [target?.latDeg, target?.lonDeg, reset]);

  const clearSite = () => {
    reset();
    onClear();
  };
  const running = state.status === "running";

  return (
    <>
      <section aria-label={t("sim.title")} className={`absolute left-4 right-4 top-32 z-20 max-h-[calc(100dvh-16.5rem)] flex-col gap-2 sm:right-auto sm:top-24 sm:w-[24rem] ${resultsShown ? "hidden lg:flex" : "flex"}`}>
        {!target && (
          <SearchPanel selected={target} onGoTo={onGoTo} onStandHere={onStandHere} onCompareLocation={onCompareLocation} onClose={onClear} hideResult placeholder="Shackleton, or -89.9, 0" placementClassName="relative z-10 shrink-0" />
        )}
        <div className="min-h-0 overflow-y-auto rounded-2xl border border-white/10 bg-[#0b0f17]/90 p-4 text-white shadow-2xl shadow-black/60 lunar-glass backdrop-blur-xl [scrollbar-color:rgba(255,255,255,0.25)_transparent] [scrollbar-width:thin]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-lime-300">{t("sim.title")}</p>
          <h2 className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/55">{t("sim.step1")}</h2>
          {target ? (
            <div className="mt-1.5 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{target.label}</p>
                <p className="font-mono text-[11px] text-white/55">{formatLatLon(target)}</p>
              </div>
              <button type="button" onClick={clearSite} disabled={running} className="shrink-0 rounded-full border border-white/15 px-3 py-1 text-xs text-white/85 hover:bg-white/10 disabled:opacity-40">{t("sim.change")}</button>
            </div>
          ) : (
            <p className="mt-1.5 text-sm leading-relaxed text-slate-300">{t("sim.pickPrompt")}</p>
          )}

          {target && (
            <>
              <h2 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-white/55">{t("sim.step2")}</h2>
              <fieldset disabled={running} className="disabled:pointer-events-none disabled:opacity-60">
                <MissionSetupForm config={config} onChange={setConfig} mapTimeMs={timeMs} />
              </fieldset>
            </>
          )}

          <div className="mt-4">
            {running ? (
              <div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-lime-300 transition-[width] duration-300" style={{ width: `${Math.max(6, (state.done / state.total) * 100)}%` }} />
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-xs text-white/70">{t("sim.running", { done: state.done, total: state.total })}</p>
                  <button type="button" onClick={cancel} className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/85 hover:bg-white/10">{t("sim.cancel")}</button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                disabled={!target}
                onClick={() => target && start({ latDeg: target.latDeg, lonDeg: target.lonDeg, label: target.label }, config)}
                className="w-full rounded-full bg-lime-300 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {target ? t("sim.run") : t("sim.needSite")}
              </button>
            )}
            {state.status === "error" && <p role="alert" className="mt-2 rounded-lg border border-red-300/30 bg-red-400/10 px-2.5 py-2 text-xs text-red-100">{state.message}</p>}
          </div>
        </div>
      </section>

      {state.status === "done" && !resultsHidden && (
        <MissionResultsPanel run={state.run} mapTimeMs={timeMs} onTimeChange={onTimeChange} weights={weights} onStandHere={onStandHere} onEdit={reset} />
      )}
    </>
  );
}
