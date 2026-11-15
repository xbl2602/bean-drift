// Every number that shapes the closing ASCII scene, in one place. The developer panel
// (cosmos-dev-panel.tsx) builds its sliders from this list, so adding a line here adds a slider.
// Once the look is settled, the defaults below are the values the page ships with.

export type ParamDef = {
  key: string;
  label: string;
  group: string;
  kind: "range" | "toggle" | "choice";
  value: number;
  min?: number;
  max?: number;
  step?: number;
  options?: readonly string[];
  hint?: string;
};

/** Character ramps, darkest to brightest. The first is the original ten-step ramp. */
export const RAMPS = [
  " .:-=+*#%@",
  " .'`^\",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$",
  " ·:;+x*#%@",
  " .oO0@",
] as const;
export const RAMP_NAMES = ["classic (10)", "dense (70)", "symbols (10)", "round (6)"] as const;

export const PARAM_DEFS = [
  // Characters
  { key: "cellScale", label: "Character size", group: "Characters", kind: "range", value: 0.58, min: 0.45, max: 1.6, step: 0.01, hint: "smaller = more characters" },
  { key: "lineHeight", label: "Line height", group: "Characters", kind: "range", value: 0.99, min: 0.85, max: 1.6, step: 0.01 },
  { key: "ramp", label: "Character set", group: "Characters", kind: "choice", value: 1, options: RAMP_NAMES },
  { key: "exposure", label: "Exposure", group: "Characters", kind: "range", value: 1.25, min: 0.3, max: 3.5, step: 0.01 },
  { key: "gamma", label: "Gamma (mid-tones)", group: "Characters", kind: "range", value: 0.8, min: 0.35, max: 1.8, step: 0.01, hint: "lower = brighter mid-tones" },
  { key: "floor", label: "Cut-off for faint cells", group: "Characters", kind: "range", value: 0.035, min: 0, max: 0.4, step: 0.005 },
  { key: "opacity", label: "Opacity", group: "Characters", kind: "range", value: 1, min: 0.2, max: 1.6, step: 0.01 },
  { key: "saturation", label: "Colour saturation", group: "Characters", kind: "range", value: 1.15, min: 0, max: 2, step: 0.01 },
  // Stars
  { key: "starDensity", label: "Star count", group: "Stars", kind: "range", value: 1.7, min: 0, max: 3, step: 0.01 },
  { key: "starBrightness", label: "Star brightness", group: "Stars", kind: "range", value: 1.1, min: 0.2, max: 3, step: 0.01 },
  { key: "starSize", label: "Star size", group: "Stars", kind: "range", value: 1, min: 0.3, max: 3, step: 0.01 },
  { key: "twinkle", label: "Twinkle", group: "Stars", kind: "range", value: 1, min: 0, max: 2, step: 0.01 },
  { key: "starDrift", label: "Drift", group: "Stars", kind: "range", value: 1, min: 0, max: 4, step: 0.01 },
  { key: "starClearing", label: "Dim stars behind the system", group: "Stars", kind: "range", value: 0.75, min: 0, max: 1, step: 0.01, hint: "keeps the planets easy to read" },
  { key: "milkyWay", label: "Milky Way band", group: "Stars", kind: "range", value: 0.55, min: 0, max: 1, step: 0.01 },
  // Black hole
  { key: "holeSize", label: "Size", group: "Black hole", kind: "range", value: 1, min: 0.5, max: 2.2, step: 0.01 },
  { key: "diskDensity", label: "Disk density", group: "Black hole", kind: "range", value: 1.5, min: 0.2, max: 2.6, step: 0.01 },
  { key: "diskBrightness", label: "Disk brightness", group: "Black hole", kind: "range", value: 1, min: 0.3, max: 2.5, step: 0.01 },
  { key: "diskSpeed", label: "Disk spin", group: "Black hole", kind: "range", value: 1, min: 0, max: 3, step: 0.01 },
  { key: "lensBrightness", label: "Light ring", group: "Black hole", kind: "range", value: 1, min: 0, max: 2.5, step: 0.01 },
  { key: "pull", label: "Pull on the stars", group: "Black hole", kind: "range", value: 1, min: 0.3, max: 3, step: 0.01 },
  // Blast
  { key: "blastSpeed", label: "Blast speed", group: "Explosion", kind: "range", value: 1, min: 0.4, max: 2.2, step: 0.01 },
  { key: "flash", label: "Flash", group: "Explosion", kind: "range", value: 1, min: 0, max: 2.5, step: 0.01 },
  { key: "sparkAmount", label: "Sparks", group: "Explosion", kind: "range", value: 1, min: 0, max: 1, step: 0.01 },
  // Solar system
  { key: "systemScale", label: "Overall size", group: "Solar system", kind: "range", value: 1, min: 0.55, max: 1.3, step: 0.01 },
  { key: "orbitFlatten", label: "Orbit tilt (flatten)", group: "Solar system", kind: "range", value: 0.4, min: 0.2, max: 0.75, step: 0.01 },
  { key: "orbitBrightness", label: "Orbit lines", group: "Solar system", kind: "range", value: 1.3, min: 0, max: 3, step: 0.01 },
  { key: "orbitSpacing", label: "Orbit dot spacing", group: "Solar system", kind: "range", value: 1.2, min: 0.5, max: 4, step: 0.01, hint: "lower = solid line" },
  { key: "planetSize", label: "Planet size", group: "Solar system", kind: "range", value: 1.7, min: 0.6, max: 3.2, step: 0.01 },
  { key: "planetBrightness", label: "Planet brightness", group: "Solar system", kind: "range", value: 1.15, min: 0.4, max: 2.5, step: 0.01 },
  { key: "planetSpeed", label: "Orbit speed", group: "Solar system", kind: "range", value: 1, min: 0, max: 3, step: 0.01 },
  { key: "sunSize", label: "Sun size", group: "Solar system", kind: "range", value: 1.5, min: 0.5, max: 3.2, step: 0.01 },
  { key: "sunBrightness", label: "Sun brightness", group: "Solar system", kind: "range", value: 1.2, min: 0.4, max: 2.5, step: 0.01 },
  { key: "coronaSize", label: "Sun corona", group: "Solar system", kind: "range", value: 1.2, min: 0, max: 3, step: 0.01 },
  { key: "beltDensity", label: "Asteroid belt", group: "Solar system", kind: "range", value: 1.4, min: 0, max: 2.5, step: 0.01 },
  { key: "tilt", label: "Pointer parallax", group: "Solar system", kind: "range", value: 1, min: 0, max: 2.5, step: 0.01 },
  { key: "showMoon", label: "Moon around Earth", group: "Solar system", kind: "toggle", value: 1 },
  { key: "labelsAlways", label: "Planet names always on", group: "Solar system", kind: "toggle", value: 1 },
  { key: "labelSize", label: "Name size", group: "Solar system", kind: "range", value: 1, min: 0.6, max: 1.8, step: 0.01 },
] as const satisfies readonly ParamDef[];

export type ParamKey = (typeof PARAM_DEFS)[number]["key"];
export type CosmosParams = Record<ParamKey, number>;

export const DEFAULT_PARAMS = Object.fromEntries(PARAM_DEFS.map((def) => [def.key, def.value])) as CosmosParams;

const STORAGE_KEY = "lq-cosmos-params";

/** Values saved by the developer panel in this browser (only read while the panel is in use). */
export function loadSavedParams(): CosmosParams {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<CosmosParams>;
    return { ...DEFAULT_PARAMS, ...saved };
  } catch {
    return { ...DEFAULT_PARAMS };
  }
}

export function saveParams(params: CosmosParams): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(params));
  } catch {
    // Private windows can refuse storage; the sliders still work for this visit.
  }
}

/** Only the values that differ from the shipped defaults, as the text the developer sends back. */
export function changedParamsText(params: CosmosParams): string {
  const changed = Object.fromEntries((Object.keys(params) as ParamKey[]).filter((key) => params[key] !== DEFAULT_PARAMS[key]).map((key) => [key, params[key]]));
  return JSON.stringify(changed, null, 2);
}
