"use client";
// 面板里"考虑地形遮挡后"的太阳/地球可见性和一年统计，数据来自本站 /api/point（和 API、MCP、AI 窗口同一份）。
// 空值（null）表示这里没有这个量，一律显示 "—"，不当成 0；读不到数据时直接说读不到。
import type { BodyVisibility, BodyYearStats, PointConditions } from "@/core/types";
import type { PointApiState } from "./use-point-api";

const percent = (fraction: number | null) => (fraction === null ? "—" : `${(fraction * 100).toFixed(fraction < 0.1 && fraction > 0 ? 1 : 0)}%`);
const hours = (value: number | null) => (value === null ? "—" : `${Math.round(value)} h`);
const formatUtc = (iso: string) => `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;

function nextChange(visibility: BodyVisibility): string {
  const fraction = visibility.diskVisibleFraction;
  if (fraction === null) return "";
  if (fraction > 0) return visibility.nextSetUtc ? ` · sets ${formatUtc(visibility.nextSetUtc)}` : " · no set within the search window";
  return visibility.nextRiseUtc ? ` · rises ${formatUtc(visibility.nextRiseUtc)}` : " · no rise within the search window";
}

function statsYear(data: PointConditions): string {
  return data.yearStats.periodStartUtc ? data.yearStats.periodStartUtc.slice(0, 4) : "the stats period";
}

function BodyRows({ label, visibility, stats }: { label: string; visibility: BodyVisibility; stats: BodyYearStats }) {
  return (
    <>
      <dt className="text-white/50">{label}</dt>
      <dd className="font-mono">
        {`${percent(visibility.diskVisibleFraction)} of disk clear`}
        {nextChange(visibility)}
        <span className="block text-[11px] text-white/55">{`year: visible ${percent(stats.visibleFraction)} · longest outage ${hours(stats.longestOutageH)}`}</span>
      </dd>
    </>
  );
}

export function TerrainVisibilityPanel({ state }: { state: PointApiState }) {
  const data = state.data;
  const unavailable = data !== null && (data.provenance.visibility.status === "unavailable" || data.provenance.yearStats.status === "unavailable");
  return (
    <div className="mt-3 border-t border-white/10 pt-3" aria-live="polite">
      <p className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-lime-300/80">
        <span>Terrain-adjusted</span>
        <span className="text-[10px] normal-case tracking-normal text-white/45">{state.status === "loading" ? "updating…" : "from /api/point"}</span>
      </p>
      {data === null || unavailable ? (
        <p className="mt-1 text-[12px] text-white/60">
          {state.status === "error" ? state.message : state.status === "loading" ? "Loading terrain-adjusted visibility…" : "Terrain-adjusted data is not available for this place."}
        </p>
      ) : (
        <>
          <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px] text-white/80">
            <BodyRows label="Sun" visibility={data.visibility.sun} stats={data.yearStats.sun} />
            <BodyRows label="Earth" visibility={data.visibility.earth} stats={data.yearStats.earth} />
            <dt className="text-white/50">Both</dt>
            <dd className="font-mono">{`${percent(data.yearStats.bothVisibleFraction)} of the year`}</dd>
          </dl>
          {state.status === "error" ? <p className="mt-1 text-[11px] text-amber-200/80">{`${state.message} Showing the last result.`}</p> : null}
          <p className="mt-1 text-[10px] leading-snug text-white/40">{`Yearly figures cover ${statsYear(data)} only, whatever date the timeline shows. Whole-Moon overview terrain, not a site survey.`}</p>
        </>
      )}
    </div>
  );
}
