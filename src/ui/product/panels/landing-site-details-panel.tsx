"use client";
import type { PointAnalysis } from "../analysis/point-analysis";
import type { LatLon } from "../moon-frames";
import { PanelButton, PanelShell } from "./panel-shell";
import { CoordinateBox, SiteMetricBars } from "./site-metric-bars";
import { SiteConditions } from "./site-conditions";
import { SitePhoto } from "./site-photo";

interface LandingSiteDetailsProps {
  point: LatLon | null;
  analysis: PointAnalysis | "error" | null;
  timeMs: number;
  onStandHere: (point: LatLon) => void;
  onChooseComparisonSites: () => void;
  onClose: () => void;
}

/** Read-only inspection stays separate from the comparison candidate list. */
export function LandingSiteDetailsPanel({point, analysis, timeMs, onStandHere, onChooseComparisonSites, onClose}: LandingSiteDetailsProps) {
  return <PanelShell title="Landing site details" onClose={onClose} side="right">
    {point ? <>
      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
        <CoordinateBox point={point} />
        <SitePhoto point={point} name="Selected location" timeMs={timeMs} onStandHere={() => onStandHere(point)} />
        <SiteConditions point={point} timeMs={timeMs} />
        <SiteMetricBars analysis={analysis ?? undefined} />
        <div className="mt-4 grid"><PanelButton onClick={() => onStandHere(point)}>Stand here</PanelButton></div>
      </section>
      <div className="mt-5 border-t border-white/10 pt-4">
        <p className="text-sm text-slate-300">Want to compare this location with other sites?</p>
        <button type="button" onClick={onChooseComparisonSites} className="mt-3 w-full rounded-xl border border-lime-200/25 bg-lime-200/10 px-4 py-3 text-sm font-semibold text-lime-100 transition hover:bg-lime-200/20">Choose sites to compare</button>
      </div>
    </> : <p className="text-sm text-slate-400">Click a location on the Moon to see its details.</p>}
  </PanelShell>;
}
