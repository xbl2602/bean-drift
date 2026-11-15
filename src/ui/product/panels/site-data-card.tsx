"use client";
import type { PointAnalysis } from "../analysis/point-analysis";
import type { LatLon } from "../moon-frames";

interface SiteDataCardProps {
  tag: string; name: string; onName: (name: string) => void; point: LatLon;
  analysis: PointAnalysis | "error" | undefined; actions: React.ReactNode;
}
const pct = (value: number) => Math.round(Math.min(1, Math.max(0, value)) * 100);
export function SiteDataCard({ tag, name, onName, point, analysis, actions }: SiteDataCardProps) {
  return <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-lime-300">{tag}</p>
    <label className="mt-3 block text-xs text-slate-400">Site name
      <input value={name} maxLength={40} onChange={(e) => onName(e.target.value)} className="mt-1 block w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm font-medium text-white focus:border-lime-300 focus:outline-none" />
    </label>
    <dl className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-black/15 p-2.5">
      <Coordinate label="Latitude" value={`${Math.abs(point.latDeg).toFixed(4)}° ${point.latDeg >= 0 ? "N" : "S"}`} />
      <Coordinate label="Longitude" value={`${Math.abs(point.lonDeg).toFixed(4)}° ${point.lonDeg >= 0 ? "E" : "W"}`} />
    </dl>
    {analysis === "error" ? <p role="status" className="mt-3 text-xs text-amber-200">Site details could not be loaded.</p> : !analysis ? <p role="status" className="mt-3 text-xs text-slate-400">Loading site details…</p> : <>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Percentage label="Sunlit time" value={analysis.illuminationFraction} note="Modelled share of time" />
        <Percentage label="Earth in view" value={analysis.earthVisibleFraction} note="Modelled visibility share" />
        <Percentage label="Ice potential index" value={analysis.iceIndex} note="Model index · not probability" />
        <Percentage label="Suitability index" value={analysis.suitability} note="Model index · not probability" />
      </div>
      <dl className="mt-3 divide-y divide-white/5 text-sm">
        <DataRow label="Elevation" value={`${analysis.heightM >= 0 ? "+" : ""}${Math.round(analysis.heightM).toLocaleString()} m`} note="NASA LOLA" />
        <DataRow label="Surface slope" value={`${analysis.slopeDeg.toFixed(1)}°`} note="NASA LOLA" />
        <DataRow label="Temperature now" value={`${Math.round(analysis.temperatureNowK - 273.15)}°C`} note={`${Math.round(analysis.temperatureNowK)} K · model`} />
      </dl>
    </>}
    <div className="mt-4 flex flex-wrap gap-2">{actions}</div>
  </section>;
}
function Percentage({ label, value, note }: { label: string; value: number; note: string }) {
  const percentage = pct(value);
  return <div className="rounded-xl border border-white/5 bg-black/15 p-2.5">
    <p className="text-[11px] text-slate-300">{label}</p><p className="mt-1 font-mono text-2xl font-semibold text-lime-100">{percentage}<span className="ml-0.5 text-sm text-lime-200/65">%</span></p>
    <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage} className="mt-2 h-1 rounded-full bg-white/10"><div className="h-full rounded-full bg-lime-300/80" style={{ width: `${percentage}%` }} /></div>
    <p className="mt-1.5 text-[9px] leading-snug text-slate-500">{note}</p>
  </div>;
}
function Coordinate({ label, value }: { label: string; value: string }) { return <div><dt className="text-[10px] text-slate-500">{label}</dt><dd className="mt-1 font-mono text-xs text-slate-200">{value}</dd></div>; }
function DataRow({ label, value, note }: { label: string; value: string; note: string }) { return <div className="flex items-center justify-between gap-2 py-2"><dt className="text-xs text-slate-400">{label}</dt><dd className="text-right"><span className="block font-mono text-sm text-slate-100">{value}</span><span className="block text-[9px] text-slate-500">{note}</span></dd></div>; }
