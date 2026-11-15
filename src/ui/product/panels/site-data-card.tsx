"use client";
// 候选点卡片（Select Landing Site）：可改的名字、经纬度、第一人称照片、各项数值长条、底部两个按钮。
import type { PointAnalysis } from "../analysis/point-analysis";
import type { LatLon } from "../moon-frames";
import { CoordinateBox, SiteMetricBars } from "./site-metric-bars";

interface SiteDataCardProps {
  tag: string; name: string; onName: (name: string) => void; point: LatLon;
  analysis: PointAnalysis | "error" | undefined; actions: React.ReactNode;
  /** 经纬度下面的第一人称照片。 */
  photo?: React.ReactNode;
}

export function SiteDataCard({ tag, name, onName, point, analysis, actions, photo }: SiteDataCardProps) {
  return <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-lime-300">{tag}</p>
    <label className="mt-3 block text-xs text-slate-400">Site name
      <input value={name} maxLength={40} onChange={(e) => onName(e.target.value)} className="mt-1 block w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm font-medium text-white focus:border-lime-300 focus:outline-none" />
    </label>
    <CoordinateBox point={point} />
    {photo}
    <SiteMetricBars analysis={analysis} />
    <div className="mt-4 grid grid-cols-2 gap-2">{actions}</div>
  </section>;
}
