"use client";
// "表现"页：任务结果、得分、关键数字和改进建议。
import { useLocale, useT } from "../i18n/use-t";
import { Caveat } from "../panels/panel-shell";
import { formatDataGB, formatEnergyKWh, formatHours, formatNumber, formatPercent } from "./mission-format";
import type { MissionResult } from "./mission-sim";

export function MissionPerformance({ result }: { result: MissionResult }) {
  const t = useT();
  const locale = useLocale();
  // 按重要性排：先看任务做成了多少、电量离耗尽有多近（生存），再看最长黑夜和电池能撑多久（为什么会断电），
  // 然后是阳光和对地通信（选址条件），最后是数据和能量总量。
  const kpis: Array<{ label: string; value: string; meter?: number }> = [
    { label: t("sim.kpi.working"), value: formatPercent(locale, result.operatingFraction), meter: result.operatingFraction },
    { label: t("sim.kpi.minBattery"), value: `${formatNumber(locale, result.minBatteryPct)}%`, meter: result.minBatteryPct / 100 },
    { label: t("sim.kpi.longestDark"), value: formatHours(locale, t, result.longestDarkH) },
    { label: t("sim.kpi.endurance"), value: formatHours(locale, t, result.batteryEnduranceH) },
    { label: t("sim.kpi.sun"), value: formatPercent(locale, result.sunFraction), meter: result.sunFraction },
    { label: t("sim.kpi.earth"), value: formatPercent(locale, result.earthFraction), meter: result.earthFraction },
    { label: t("sim.kpi.longestNoContact"), value: formatHours(locale, t, result.longestNoContactH) },
    { label: t("sim.kpi.data"), value: `${formatDataGB(locale, result.dataReturnedGB)} / ${formatDataGB(locale, result.dataGeneratedGB)}` },
    { label: t("sim.kpi.energy"), value: `${formatEnergyKWh(locale, result.energyGeneratedKWh)} / ${formatEnergyKWh(locale, result.energyUsedKWh)}` },
  ];
  const advice = (
    <>
      <h3 className="mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">{t("sim.advice")}</h3>
      <ul className="mt-1.5 space-y-1.5">
        {result.advice.map((item) => (
          <li key={item.key} className="flex gap-2 rounded-lg border border-lime-300/15 bg-lime-300/5 px-2.5 py-2 text-xs leading-snug text-white/85">
            <span aria-hidden className="text-lime-300">→</span>
            <span>{t(`sim.advice.${item.key}`, Object.fromEntries(Object.entries(item.values).map(([name, value]) => [name, formatNumber(locale, value, 1)])))}</span>
          </li>
        ))}
      </ul>
    </>
  );

  return (
    <div>
      <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <ScoreRing score={result.score} outcome={result.outcome} />
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.14em] text-white/55">{t("sim.score")}</p>
          <p className="text-2xl font-semibold tabular-nums">{result.score}<span className="text-sm font-normal text-white/45"> / 100</span></p>
        </div>
      </div>

      {advice}

      <dl className="mt-4 grid grid-cols-2 gap-1.5">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2">
            <dt className="text-[10px] leading-tight text-white/55">{kpi.label}</dt>
            <dd className="mt-0.5 text-sm font-medium tabular-nums text-white">{kpi.value}</dd>
            {kpi.meter !== undefined && (
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-lime-300" style={{ width: `${Math.max(2, Math.min(100, kpi.meter * 100))}%` }} />
              </div>
            )}
          </div>
        ))}
      </dl>
      <Caveat>{t("sim.assumptions")}</Caveat>
    </div>
  );
}

const OUTCOME_COLOR = { success: "#a3e635", partial: "#fbbf24", failed: "#f87171" } as const;

function ScoreRing({ score, outcome }: { score: number; outcome: MissionResult["outcome"] }) {
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  return (
    <svg viewBox="0 0 56 56" className="h-14 w-14 shrink-0 -rotate-90" aria-hidden>
      <circle cx="28" cy="28" r={radius} fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="6" />
      <circle cx="28" cy="28" r={radius} fill="none" stroke={OUTCOME_COLOR[outcome]} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${(score / 100) * circumference} ${circumference}`} />
    </svg>
  );
}
