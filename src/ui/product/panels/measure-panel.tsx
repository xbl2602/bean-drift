"use client";
// Measure Distance：打开时点击地图依次加点，面板里显示每一段和总长（球面大圆距离）。
import { formatLatLon, greatCircleDistanceKm, type LatLon } from "../moon-frames";
import { Caveat, PanelButton, PanelShell } from "./panel-shell";

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

      <ol className="mt-3 space-y-1 text-xs">
        {points.map((point, i) => (
          <li key={`${i}-${point.latDeg}-${point.lonDeg}`} className="flex items-baseline justify-between gap-2 rounded-lg bg-white/[0.04] px-2.5 py-1.5">
            <span className="font-mono text-white/75">
              {i + 1}. {formatLatLon(point)}
            </span>
            {i > 0 && <span className="shrink-0 font-mono text-yellow-100/90">+{formatKm(legsKm[i - 1])}</span>}
          </li>
        ))}
      </ol>

      <div className="mt-3 flex gap-2">
        <PanelButton onClick={onUndo} disabled={points.length === 0}>Undo last point</PanelButton>
        <PanelButton onClick={onClear} disabled={points.length === 0}>Clear</PanelButton>
      </div>
      <Caveat>Shortest path over a smooth sphere of radius 1737.4 km (great-circle distance). Hills and craters along the way are not added, so real surface travel is longer.</Caveat>
    </PanelShell>
  );
}
