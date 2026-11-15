"use client";
// Measure Distance：打开时点击地图依次加点，面板里显示每一段和总长（球面大圆距离）。
import { formatLatLon, greatCircleDistanceKm, type LatLon } from "../moon-frames";
import { Caveat, PanelShell } from "./panel-shell";

interface MeasurePanelProps {
  points: LatLon[];
  onUndo: () => void;
  onClear: () => void;
  onClose: () => void;
}

const formatKm = (km: number) => `${km.toFixed(km < 100 ? 2 : km < 1000 ? 1 : 0)} km`;

export function MeasurePanel({ points, onUndo, onClear, onClose }: MeasurePanelProps) {
  const legsKm = points.slice(1).map((point, i) => greatCircleDistanceKm(points[i], point));
  const totalKm = legsKm.reduce((sum, km) => sum + km, 0);

  return (
    <PanelShell title="Measure Distance" onClose={onClose}>
      <p className="text-sm text-white/75">Click two or more places on the map. Each click adds a point to the path.</p>

      <div className="mt-3 rounded-xl border border-yellow-200/25 bg-yellow-200/5 p-3 text-center">
        <p className="font-mono text-2xl text-yellow-100">{points.length >= 2 ? formatKm(totalKm) : "—"}</p>
        <p className="text-[11px] uppercase tracking-wide text-white/50">Total distance</p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2" role="group" aria-label="Edit measurement points">
        <button
          type="button"
          onClick={onUndo}
          disabled={points.length === 0}
          className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-yellow-200/50 bg-yellow-200 px-2 py-3 text-xs font-semibold text-slate-950 shadow-sm transition hover:bg-yellow-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-200 disabled:cursor-not-allowed disabled:border-slate-300/25 disabled:bg-slate-200/10 disabled:text-slate-300/80 disabled:shadow-none"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 4-5 5 5 5M4 9h9a6 6 0 0 1 0 12h-2" /></svg>
          Undo last point
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={points.length === 0}
          className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-rose-300/50 bg-rose-300/15 px-2 py-3 text-xs font-semibold text-rose-100 transition hover:border-rose-200 hover:bg-rose-300/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-200 disabled:cursor-not-allowed disabled:border-slate-300/25 disabled:bg-slate-200/10 disabled:text-slate-300/80"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6m4-6v6" /></svg>
          Clear all points
        </button>
      </div>
      <p className="mt-2 text-xs text-white/60" role="status">
        {points.length === 0 ? "Add a point on the map to enable these actions." : `${points.length} ${points.length === 1 ? "point" : "points"} selected · undo removes only the latest point.`}
      </p>

      <ol className="mt-3 max-h-44 space-y-1 overflow-y-auto text-xs">
        {points.map((point, i) => (
          <li key={`${i}-${point.latDeg}-${point.lonDeg}`} className="flex items-baseline justify-between gap-2 rounded-lg bg-white/[0.04] px-2.5 py-1.5">
            <span className="font-mono text-white/75">
              {i + 1}. {formatLatLon(point)}
            </span>
            {i > 0 && <span className="shrink-0 font-mono text-yellow-100/90">+{formatKm(legsKm[i - 1])}</span>}
          </li>
        ))}
      </ol>


      <Caveat>Shortest path over a smooth sphere of radius 1737.4 km (great-circle distance). Hills and craters along the way are not added, so real surface travel is longer.</Caveat>
    </PanelShell>
  );
}
