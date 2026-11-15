"use client";
// 右上角：当前分析图层的小标签（可一键回到月面影像）、阳光明暗开关、经纬网开关、2D / 3D 切换。
import { LAYER_INFO, type LayerSettings } from "./map-layers";

export type MapMode = "2d" | "3d";

interface ViewControlsProps {
  mode: MapMode;
  onModeChange: (mode: MapMode) => void;
  layers: LayerSettings;
  onLayersChange: (layers: LayerSettings) => void;
}

export function ViewControls({ mode, onModeChange, layers, onLayersChange }: ViewControlsProps) {
  const showingData = layers.base !== "color";
  return (
    <div className="absolute right-4 top-20 z-20 flex flex-wrap items-center justify-end gap-2 sm:right-6 sm:top-6">
      {showingData && (
        <button
          type="button"
          onClick={() => onLayersChange({ ...layers, base: "color" })}
          title="Back to surface imagery"
          className="flex items-center gap-1.5 rounded-full border border-lime-300/40 bg-lime-300/15 py-1.5 pl-3 pr-2 text-xs font-medium text-lime-100 lunar-glass backdrop-blur-md hover:bg-lime-300/25"
        >
          {LAYER_INFO[layers.base].label}
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      )}
      <div className="flex rounded-full border border-white/15 bg-black/55 p-1 lunar-glass backdrop-blur-md">
        <IconToggle
          label="Sunlight and shadow (surface imagery only)"
          pressed={layers.sunlight}
          disabled={showingData}
          onChange={(sunlight) => onLayersChange({ ...layers, sunlight })}
          path="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-5v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"
        />
        <IconToggle label="Latitude / longitude grid, every 30°" pressed={layers.grid} onChange={(grid) => onLayersChange({ ...layers, grid })} path="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z" />
      </div>
      <div data-tour="views" role="radiogroup" aria-label="Map view" className="flex rounded-full border border-white/15 bg-black/55 p-1 lunar-glass backdrop-blur-md">
        {(["2d", "3d"] as const).map((m) => (
          <button
            key={m}
            type="button"
            data-tour={m}
            role="radio"
            aria-checked={mode === m}
            onClick={() => onModeChange(m)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${mode === m ? "bg-lime-300 text-black" : "text-white/70 hover:text-white"}`}
          >
            {m.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}

function IconToggle({ label, pressed, disabled, onChange, path }: { label: string; pressed: boolean; disabled?: boolean; onChange: (pressed: boolean) => void; path: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={() => onChange(!pressed)}
      className={`grid h-8 w-8 place-items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-35 ${pressed ? "bg-white/20 text-lime-200" : "text-white/55 hover:text-white"}`}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={path} /></svg>
    </button>
  );
}
