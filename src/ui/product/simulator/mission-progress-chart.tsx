"use client";
// "任务进程"图：从上到下是阳光、地球通信、电池电量曲线、工作状态，横轴是任务第几天。
// 鼠标移上去看那一刻的数值；点一下把地图的时间移到那一刻（太阳和阴影跟着变）。
import { useRef, useState } from "react";
import { useLocale, useT } from "../i18n/use-t";
import { formatNumber, formatUtc, missionDay } from "./mission-format";
import type { MissionMode, MissionResult, MissionSample } from "./mission-sim";

const W = 320;
const LEFT = 0;
const SUN_Y = 4, EARTH_Y = 22, BAND_H = 12;
const BATTERY_TOP = 42, BATTERY_BOTTOM = 112;
const MODE_Y = 120, MODE_H = 6;
const AXIS_Y = 140;
const H = 146;

const SUN_COLOR = "#fcd34d";
const EARTH_COLOR = "#38bdf8";
/** 用主题的绿色（浅色外观下自动换成深一点的绿，白底上看得清）。 */
const BATTERY_COLOR = "var(--color-lime-300)";
const MODE_COLOR: Record<MissionMode, string> = { operating: "#a3e635", hibernating: "#64748b", failed: "#f87171" };

interface Segment { x0: number; x1: number; key: string }

/** 把逐点的真/假（或状态）连成一段段色块。 */
function segments(samples: MissionSample[], xOf: (timeMs: number) => number, keyOf: (sample: MissionSample) => string | null): Segment[] {
  const result: Segment[] = [];
  for (let i = 0; i < samples.length - 1; i++) {
    const key = keyOf(samples[i]);
    if (key === null) continue;
    const x0 = xOf(samples[i].timeMs), x1 = xOf(samples[i + 1].timeMs);
    const last = result[result.length - 1];
    if (last && last.key === key && Math.abs(last.x1 - x0) < 0.01) last.x1 = x1;
    else result.push({ x0, x1, key });
  }
  return result;
}

interface MissionProgressChartProps {
  result: MissionResult;
  mapTimeMs: number;
  onTimeChange: (timeMs: number) => void;
}

export function MissionProgressChart({ result, mapTimeMs, onTimeChange }: MissionProgressChartProps) {
  const t = useT();
  const locale = useLocale();
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverMs, setHoverMs] = useState<number | null>(null);
  const span = result.endMs - result.startMs;
  const xOf = (timeMs: number) => LEFT + ((timeMs - result.startMs) / span) * (W - LEFT);
  const yOfBattery = (pct: number) => BATTERY_BOTTOM - (pct / 100) * (BATTERY_BOTTOM - BATTERY_TOP);
  const timeAtPointer = (clientX: number) => {
    const box = svgRef.current?.getBoundingClientRect();
    if (!box || box.width === 0) return null;
    const fraction = Math.min(1, Math.max(0, (clientX - box.left) / box.width));
    return result.startMs + fraction * span;
  };

  const sun = segments(result.samples, xOf, (s) => (s.sun ? "sun" : null));
  const earth = segments(result.samples, xOf, (s) => (s.earth ? "earth" : null));
  const modes = segments(result.samples, xOf, (s) => s.mode);
  const batteryLine = result.samples.map((s) => `${xOf(s.timeMs).toFixed(2)},${yOfBattery(s.batteryPct).toFixed(2)}`).join(" ");
  const totalDays = span / 86_400_000;
  const tickEvery = totalDays <= 7 ? 1 : totalDays <= 31 ? 7 : totalDays <= 120 ? 30 : 60;
  const ticks = Array.from({ length: Math.floor(totalDays / tickEvery) + 1 }, (_, i) => i * tickEvery);
  const hovered = hoverMs === null ? null : sampleAt(result.samples, hoverMs);
  const mapInRange = mapTimeMs >= result.startMs && mapTimeMs <= result.endMs;

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-white/65">
        <Legend color={SUN_COLOR} label={t("sim.chart.sun")} />
        <Legend color={EARTH_COLOR} label={t("sim.chart.earth")} />
        <Legend color={BATTERY_COLOR} label={t("sim.chart.battery")} line />
        <Legend color={MODE_COLOR.operating} label={t("sim.mode.operating")} />
        <Legend color={MODE_COLOR.hibernating} label={t("sim.mode.hibernating")} />
        {result.failedAtMs !== null && <Legend color={MODE_COLOR.failed} label={t("sim.mode.failed")} />}
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full cursor-crosshair select-none rounded-lg bg-white/[0.04] text-white"
        role="img"
        aria-label={t("sim.tab.progress")}
        onPointerMove={(event) => setHoverMs(timeAtPointer(event.clientX))}
        onPointerLeave={() => setHoverMs(null)}
        onClick={(event) => {
          const timeMs = timeAtPointer(event.clientX);
          if (timeMs !== null) onTimeChange(Math.round(timeMs));
        }}
      >
        <rect x={LEFT} y={SUN_Y} width={W - LEFT} height={BAND_H} fill="currentColor" opacity="0.04" />
        <rect x={LEFT} y={EARTH_Y} width={W - LEFT} height={BAND_H} fill="currentColor" opacity="0.04" />
        {sun.map((s) => <rect key={`s${s.x0}`} x={s.x0} y={SUN_Y} width={Math.max(0.6, s.x1 - s.x0)} height={BAND_H} fill={SUN_COLOR} opacity="0.85" />)}
        {earth.map((s) => <rect key={`e${s.x0}`} x={s.x0} y={EARTH_Y} width={Math.max(0.6, s.x1 - s.x0)} height={BAND_H} fill={EARTH_COLOR} opacity="0.85" />)}
        {[0, 25, 50, 75, 100].map((pct) => (
          <g key={pct}>
            <line x1={LEFT} x2={W} y1={yOfBattery(pct)} y2={yOfBattery(pct)} stroke="currentColor" strokeOpacity={pct === 0 || pct === 100 ? 0.18 : 0.07} strokeWidth="0.5" />
            {pct > 0 && <text x={W - 2} y={yOfBattery(pct) + 7} textAnchor="end" fontSize="6" fill="currentColor" fillOpacity="0.4">{pct}%</text>}
          </g>
        ))}
        <line x1={LEFT} x2={W} y1={yOfBattery(25)} y2={yOfBattery(25)} stroke="#f59e0b" strokeOpacity="0.45" strokeWidth="0.6" strokeDasharray="3 2" />
        <polygon points={`${xOf(result.startMs)},${BATTERY_BOTTOM} ${batteryLine} ${xOf(result.endMs)},${BATTERY_BOTTOM}`} style={{ fill: BATTERY_COLOR }} opacity="0.12" />
        <polyline points={batteryLine} fill="none" style={{ stroke: BATTERY_COLOR }} strokeWidth="1.3" strokeLinejoin="round" />
        {modes.map((s) => <rect key={`m${s.x0}`} x={s.x0} y={MODE_Y} width={Math.max(0.6, s.x1 - s.x0)} height={MODE_H} fill={MODE_COLOR[s.key as MissionMode]} />)}
        {ticks.map((day) => (
          <g key={day}>
            <line x1={xOf(result.startMs + day * 86_400_000)} x2={xOf(result.startMs + day * 86_400_000)} y1={MODE_Y + MODE_H + 2} y2={MODE_Y + MODE_H + 5} stroke="currentColor" strokeOpacity="0.35" strokeWidth="0.6" />
            <text x={Math.min(W - 2, Math.max(2, xOf(result.startMs + day * 86_400_000)))} y={AXIS_Y + 3} textAnchor={edgeAnchor(xOf(result.startMs + day * 86_400_000))} fontSize="6.5" fill="currentColor" fillOpacity="0.5">{t("sim.day", { n: day + 1 })}</text>
          </g>
        ))}
        {result.failedAtMs !== null && <line x1={xOf(result.failedAtMs)} x2={xOf(result.failedAtMs)} y1={0} y2={MODE_Y + MODE_H} stroke={MODE_COLOR.failed} strokeWidth="1" />}
        {mapInRange && <line x1={xOf(mapTimeMs)} x2={xOf(mapTimeMs)} y1={0} y2={MODE_Y + MODE_H} stroke="currentColor" strokeOpacity="0.8" strokeWidth="0.8" />}
        {hoverMs !== null && <line x1={xOf(hoverMs)} x2={xOf(hoverMs)} y1={0} y2={MODE_Y + MODE_H} stroke="currentColor" strokeOpacity="0.4" strokeWidth="0.6" strokeDasharray="2 2" />}
      </svg>
      <p className="mt-1.5 min-h-[2.5em] text-[11px] leading-snug text-white/60">
        {hovered && hoverMs !== null ? (
          <>
            <span className="font-medium text-white/85">{t("sim.day", { n: missionDay(result.startMs, hoverMs) })}</span> · {formatUtc(locale, hoverMs)}
            <br />
            {t("sim.chart.battery")} {formatNumber(locale, hovered.batteryPct)}% · {t(`sim.mode.${hovered.mode}`)} · {t("sim.chart.sun")} {hovered.sun ? "✓" : "✕"} · {t("sim.chart.earth")} {hovered.earth ? "✓" : "✕"}
          </>
        ) : (
          t("sim.chart.click")
        )}
      </p>
    </div>
  );
}

/** 两头的刻度文字往里对齐，不被裁掉。 */
const edgeAnchor = (x: number) => (x < 24 ? "start" : x > W - 24 ? "end" : "middle");

function sampleAt(samples: MissionSample[], timeMs: number): MissionSample {
  let found = samples[0];
  for (const sample of samples) {
    if (sample.timeMs > timeMs) break;
    found = sample;
  }
  return found;
}

function Legend({ color, label, line }: { color: string; label: string; line?: boolean }) {
  return (
    <span className="flex items-center gap-1">
      <span className={line ? "h-0.5 w-3 rounded" : "h-2 w-2 rounded-sm"} style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
