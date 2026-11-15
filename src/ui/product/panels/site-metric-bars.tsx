"use client";
// 一个点的各项数值，每项一行：上面是标题，下面是一条长条，数值写在长条右端。
// 候选点面板、着陆点讲解、查数据报告都用这一份，保证名称、颜色、来源标注一致。
// 百分比类直接按 0–100% 填；高程、坡度、温度按各自的范围填，右端写真实数值和单位。
import type { PointAnalysis } from "../analysis/point-analysis";
import { RELIEF_MAX_HEIGHT_M, RELIEF_MIN_HEIGHT_M, SLOPE_MAX_DEG } from "../moon-assets";
import type { LatLon } from "../moon-frames";

/** 温度条的范围：月面大致从极区阴影里的 40 K 到赤道正午的 400 K。 */
const TEMPERATURE_MIN_K = 40;
const TEMPERATURE_MAX_K = 400;
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const share = (value: number, min: number, max: number) => clamp01((value - min) / (max - min));
const percent = (fraction: number) => `${Math.round(clamp01(fraction) * 100)}%`;

export function SiteMetricBars({ analysis }: { analysis: PointAnalysis | "error" | null | undefined }) {
  if (analysis === "error") return <p role="status" className="mt-3 text-xs text-amber-200">Site details could not be loaded.</p>;
  if (!analysis) return <p role="status" className="mt-3 text-xs text-slate-400">Loading site details…</p>;
  return (
    // 按重要性从高到低：
    // 1 综合适宜度（一眼看结论）→ 2 光照（发电）→ 3 对地可见（通信）：这两项是赛题的核心
    // → 4 坡度（能不能安全着陆）→ 5 水冰（资源）→ 6 当前温度（只是此刻的快照）→ 7 高程（背景信息）
    <dl className="mt-4 space-y-3">
      <BarRow label="Suitability index" tone="sun" source="Model index" fill={analysis.suitability} value={percent(analysis.suitability)} />
      <BarRow label="Sunlit time" tone="sun" source="Model" fill={analysis.illuminationFraction} value={percent(analysis.illuminationFraction)} />
      <BarRow label="Earth in view" tone="earth" source="Model" fill={analysis.earthVisibleFraction} value={percent(analysis.earthVisibleFraction)} />
      <BarRow label="Surface slope" tone="terrain" source="NASA LOLA" fill={share(analysis.slopeDeg, 0, SLOPE_MAX_DEG)} value={`${analysis.slopeDeg.toFixed(1)}°`} />
      <BarRow label="Ice potential index" tone="earth" source="Model index" fill={analysis.iceIndex} value={percent(analysis.iceIndex)} />
      <BarRow label="Temperature now" tone="sun" source="Model" fill={share(analysis.temperatureNowK, TEMPERATURE_MIN_K, TEMPERATURE_MAX_K)} value={`${Math.round(analysis.temperatureNowK - 273.15)}°C`} />
      <BarRow label="Elevation" tone="terrain" source="NASA LOLA" fill={share(analysis.heightM, RELIEF_MIN_HEIGHT_M, RELIEF_MAX_HEIGHT_M)} value={`${analysis.heightM >= 0 ? "+" : ""}${Math.round(analysis.heightM).toLocaleString()} m`} />
      <p className="text-[9px] leading-snug text-slate-500">Index values are model scores, not probabilities. Elevation, slope and temperature bars show where the value sits in the Moon&apos;s range.</p>
    </dl>
  );
}

/** 纬度、经度两格（四位小数）。 */
export function CoordinateBox({ point }: { point: LatLon }) {
  return (
    <dl className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-black/15 p-2.5">
      <Coordinate label="Latitude" value={`${Math.abs(point.latDeg).toFixed(4)}° ${point.latDeg >= 0 ? "N" : "S"}`} />
      <Coordinate label="Longitude" value={`${Math.abs(point.lonDeg).toFixed(4)}° ${point.lonDeg >= 0 ? "E" : "W"}`} />
    </dl>
  );
}

/**
 * 长条的配色和对比窗口（Compare landing sites）里的光照/地球长条同一套：
 * 太阳相关 = 沙金色，地球/水冰相关 = 灰蓝色，地形 = 中性灰；没填满的部分是同样的斜纹底。
 */
const TONES = {
  sun: { label: "text-[#dfc89d]", fill: "bg-[linear-gradient(90deg,#ae956c,#e3c993)]", value: "text-[#f3e3c0]" },
  earth: { label: "text-[#a8c8d9]", fill: "bg-[linear-gradient(90deg,#779aaf,#accddd)]", value: "text-[#d3e6ef]" },
  terrain: { label: "text-slate-300", fill: "bg-[linear-gradient(90deg,#7b8794,#b9c3cf)]", value: "text-slate-100" },
} as const;
type Tone = keyof typeof TONES;

function BarRow({ label, tone, source, fill, value }: { label: string; tone: Tone; source: string; fill: number; value: string }) {
  const width = Math.round(clamp01(fill) * 100);
  const colours = TONES[tone];
  return <div>
    <dt className={`flex items-baseline justify-between gap-2 text-xs font-medium ${colours.label}`}>{label}<span className="text-[9px] font-normal uppercase tracking-[0.12em] text-slate-500">{source}</span></dt>
    <dd role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={width} aria-valuetext={value} className="relative mt-1.5 h-8 overflow-hidden border border-white/10 bg-[repeating-linear-gradient(45deg,#46505d_0px,#46505d_2px,#141c26_2px,#141c26_6px)]">
      <span className={`absolute inset-y-0 left-0 ${colours.fill}`} style={{ width: `${width}%` }} />
      <span className={`absolute inset-y-0 right-2 my-auto flex h-6 items-center rounded-sm px-1.5 font-mono text-sm font-semibold bg-[#141c26]/90 ${colours.value}`}>{value}</span>
    </dd>
  </div>;
}
function Coordinate({ label, value }: { label: string; value: string }) { return <div><dt className="text-[10px] text-slate-500">{label}</dt><dd className="mt-1 font-mono text-xs text-slate-200">{value}</dd></div>; }
