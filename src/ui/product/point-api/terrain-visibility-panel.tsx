"use client";
// "发电和对地通信（考虑真实地形）"：太阳/地球此刻能不能看到、什么时候变，以及一年里的统计。
// 数据来自本站 /api/point（和 API、MCP、AI 窗口同一份），算了山和环形山边缘的遮挡。
// 用大白话写：现在有没有阳光 / 能不能联系地球；一年里多少时间有；最长要熬多久。
// 空值（null）表示这里没有这个量，一律显示 "—"，不当成 0；读不到数据时直接说读不到。
import type { BodyVisibility, BodyYearStats, PointConditions } from "@/core/types";
import type { PointApiState } from "./use-point-api";

const percent = (fraction: number | null) => (fraction === null ? "—" : `${(fraction * 100).toFixed(fraction < 0.1 && fraction > 0 ? 1 : 0)}%`);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "29 Nov 2026, 04:04 UTC" */
const formatUtc = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}, ${iso.slice(11, 16)} UTC`;

/** 时长：两天以内写小时，更长的加上"约几天"。 */
function duration(hours: number | null): string {
  if (hours === null) return "—";
  if (hours <= 0) return "None";
  const h = Math.round(hours);
  return h < 48 ? `${h} h` : `${h} h (about ${Math.round(h / 24)} days)`;
}

/** 此刻：能不能看到，什么时候变。 */
function nowText(body: "Sun" | "Earth", visibility: BodyVisibility, stats: BodyYearStats): string {
  const fraction = visibility.diskVisibleFraction;
  if (fraction === null) return "—";
  if (fraction > 0) {
    const how = fraction < 0.999 ? `Partly (${percent(fraction)} of the ${body === "Sun" ? "Sun" : "Earth"} showing)` : "Yes";
    if (visibility.nextSetUtc) return `${how}, until ${formatUtc(visibility.nextSetUtc)}`;
    return stats.visibleFraction !== null && stats.visibleFraction >= 0.999 ? `${how}, always in view` : `${how}, for a long while`;
  }
  if (visibility.nextRiseUtc) return `No, back at ${formatUtc(visibility.nextRiseUtc)}`;
  return stats.visibleFraction === 0 ? "No, never in view here" : "No, not back for a long while";
}

function statsYear(data: PointConditions): string {
  return data.yearStats.periodStartUtc ? data.yearStats.periodStartUtc.slice(0, 4) : "one year";
}

function Row({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="shrink-0 text-xs text-slate-400">{label}{note && <span className="block text-[10px] text-slate-500">{note}</span>}</dt>
      <dd className="text-right text-[13px] font-medium text-white/90">{value}</dd>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{title}</p>
      <dl className="divide-y divide-white/[0.06]">{children}</dl>
    </div>
  );
}

export function TerrainVisibilityPanel({ state }: { state: PointApiState }) {
  const data = state.data;
  const unavailable = data !== null && (data.provenance.visibility.status === "unavailable" || data.provenance.yearStats.status === "unavailable");
  return (
    <section className="mt-3 border-t border-white/10 pt-3" aria-live="polite" aria-label="Power and Earth contact with real terrain">
      <h3 className="flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-lime-300/85">
        Power & Earth contact
        {state.status === "loading" && <span className="text-[10px] font-normal normal-case tracking-normal text-white/45">updating…</span>}
      </h3>
      <p className="mt-1 text-[11px] leading-snug text-slate-400">With real terrain: hills and crater rims can block the Sun or Earth.</p>
      {data === null || unavailable ? (
        <p className="mt-2 text-[12px] text-white/60">
          {state.status === "error" ? state.message : state.status === "loading" ? "Loading…" : "Not available for this place."}
        </p>
      ) : (
        <>
          <Group title="Right now">
            <Row label="Sunlight" value={nowText("Sun", data.visibility.sun, data.yearStats.sun)} />
            <Row label="Earth contact" value={nowText("Earth", data.visibility.earth, data.yearStats.earth)} />
          </Group>
          <Group title={`Over a year (${statsYear(data)})`}>
            <Row label="Sunny" value={`${percent(data.yearStats.sun.visibleFraction)} of the time`} />
            <Row label="Longest darkness" note="How long batteries must last" value={duration(data.yearStats.sun.longestOutageH)} />
            <Row label="Earth in view" value={`${percent(data.yearStats.earth.visibleFraction)} of the time`} />
            <Row label="Longest without contact" value={duration(data.yearStats.earth.longestOutageH)} />
            <Row label="Power and contact together" value={`${percent(data.yearStats.bothVisibleFraction)} of the time`} />
          </Group>
          {state.status === "error" ? <p className="mt-1 text-[11px] text-amber-200/80">{`${state.message} Showing the last result.`}</p> : null}
          <p className="mt-2 text-[10px] leading-snug text-white/40">{`Yearly figures are for ${statsYear(data)}, whatever date the timeline shows. Based on whole-Moon terrain maps, not a detailed site survey.`}</p>
        </>
      )}
    </section>
  );
}
