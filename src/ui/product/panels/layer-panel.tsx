"use client";
// 分析图层的面板（地形高度、光照、温度、水冰、坡度、选址评分共用）：说明、图例、数据来源提醒。
// 选址评分额外有一组"选哪些标准、各占多重"的控件。
import type { PointAnalysis } from "../analysis/point-analysis";
import { LAYER_INFO, RAMPS, type BaseLayer, type SuitabilityWeights } from "../map-layers";
import { Caveat, PanelShell } from "./panel-shell";

type DataLayer = Exclude<BaseLayer, "color">;

interface LayerPanelProps {
  title: string;
  layer: DataLayer;
  weights: SuitabilityWeights;
  onWeightsChange: (weights: SuitabilityWeights) => void;
  /** 鼠标悬停点的分析结果，用来显示"这里的数值"。 */
  hover: PointAnalysis | null;
  onClose: () => void;
}

const HOVER_VALUE: Record<DataLayer, (a: PointAnalysis) => string> = {
  elevation: (a) => `${a.heightM >= 0 ? "+" : ""}${(a.heightM / 1000).toFixed(2)} km`,
  slope: (a) => `${a.slopeDeg.toFixed(1)}°`,
  illumination: (a) => `${(a.illuminationFraction * 100).toFixed(0)}% sunlit`,
  temperature: (a) => `${a.temperatureNowK.toFixed(0)} K (${(a.temperatureNowK - 273.15).toFixed(0)}°C)`,
  ice: (a) => `${a.iceIndex.toFixed(2)}${a.permanentShadow > 0.5 ? " · permanent shadow" : ""}`,
  suitability: (a) => a.suitability.toFixed(2),
};

const CRITERIA: Array<{ key: keyof SuitabilityWeights; label: string; hint: string }> = [
  { key: "slope", label: "Gentle slope", hint: "Safer landing and building; steeper than 15–25° is ruled out" },
  { key: "sunlight", label: "Sunlight", hint: "More time in sunlight for solar power" },
  { key: "earth", label: "Earth in view", hint: "Direct radio link to Earth" },
  { key: "ice", label: "Water-ice access", hint: "In or within 20 km of a cold trap" },
  { key: "thermal", label: "Mild peak temperature", hint: "Lower monthly peak temperature" },
];

export function LayerPanel({ title, layer, weights, onWeightsChange, hover, onClose }: LayerPanelProps) {
  const info = LAYER_INFO[layer];
  return (
    <PanelShell title={title} onClose={onClose} side="right">
      <p className="text-sm text-white/80">{info.description}</p>

      {info.legend && (
        <div className="mt-3">
          <div className="h-3 rounded-full" style={{ background: `linear-gradient(to right, ${RAMPS[layer].join(", ")})` }} />
          <div className="mt-1 flex justify-between font-mono text-[11px] text-white/60">
            <span>{info.legend.left}</span>
            <span>{info.legend.right}</span>
          </div>
        </div>
      )}

      <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
        <p className="text-[10px] uppercase tracking-wide text-white/45">Under the cursor</p>
        <p className="font-mono text-base text-white">{hover ? HOVER_VALUE[layer](hover) : "Hover over the map"}</p>
      </div>

      {layer === "suitability" && (
        <fieldset className="mt-4 space-y-2.5">
          <legend className="text-xs text-white/55">Criteria and weights</legend>
          {CRITERIA.map(({ key, label, hint }) => (
            <div key={key}>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="accent-lime-300" checked={weights[key] > 0} onChange={(e) => onWeightsChange({ ...weights, [key]: e.target.checked ? 0.6 : 0 })} />
                <span className="flex-1">{label}</span>
                <span className="font-mono text-[11px] text-white/55">{Math.round(weights[key] * 100)}</span>
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(weights[key] * 100)}
                onChange={(e) => onWeightsChange({ ...weights, [key]: Number(e.target.value) / 100 })}
                aria-label={`${label} weight`}
                className="mt-0.5 w-full accent-lime-300"
              />
              <p className="text-[11px] text-white/40">{hint}</p>
            </div>
          ))}
          {hover && (
            <p className="rounded-lg bg-white/[0.04] px-2.5 py-1.5 font-mono text-[11px] text-white/65">
              slope {hover.scores.slope.toFixed(2)} · sun {hover.scores.sunlight.toFixed(2)} · earth {hover.scores.earth.toFixed(2)} · ice {hover.scores.ice.toFixed(2)} · thermal {hover.scores.thermal.toFixed(2)}
            </p>
          )}
        </fieldset>
      )}

      <Caveat>{info.caveat}</Caveat>
    </PanelShell>
  );
}
