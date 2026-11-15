import type { PointAnalysis } from "../analysis/point-analysis";
import type { SiteAnalyses } from "../analysis/use-point-analysis";
import type { SavedSite } from "../overlay/annotations";

export type SitePriority = keyof PointAnalysis["scores"];
export const SITE_PRIORITIES: Array<{ key: SitePriority; label: string; detail: string }> = [
  { key: "slope", label: "Flatter terrain", detail: "Prefer the existing gentler-slope score." },
  { key: "sunlight", label: "More sunlight", detail: "Prefer the existing sunlit-time score." },
  { key: "earth", label: "Earth visibility", detail: "Prefer the existing Earth-contact score." },
  { key: "ice", label: "Ice accessibility", detail: "Prefer modelled access to potential ice, including nearby cold traps." },
  { key: "thermal", label: "Milder peak temperatures", detail: "Prefer the model's milder peak-temperature score; not a chosen operating temperature range." },
];
export const DEFAULT_SITE_PRIORITIES: SitePriority[] = ["slope", "sunlight", "earth"];
export interface RankedSite { site: SavedSite; score: number | null; rank: number | null; state: "ready" | "loading" | "error" }

/** Equal-weight average of the already-normalized model scores. No candidate-relative normalization. */
export function rankLandingSites(sites: SavedSite[], analyses: SiteAnalyses, priorities: SitePriority[]): RankedSite[] {
  const selected = [...new Set(priorities)];
  const result: RankedSite[] = sites.map((site) => {
    const analysis = analyses[site.id];
    if (!analysis) return { site, score: null, rank: null, state: "loading" };
    if (analysis === "error") return { site, score: null, rank: null, state: "error" };
    const scores = selected.map((key) => analysis.scores[key]);
    if (scores.some((score) => !Number.isFinite(score))) return { site, score: null, rank: null, state: "error" };
    return { site, score: scores.length ? scores.reduce((sum, score) => sum + Math.min(1, Math.max(0, score)), 0) / scores.length : null, rank: null, state: "ready" };
  });
  if (!selected.length) return result;
  result.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  let previous: number | null = null, rank = 0;
  result.forEach((entry, index) => {
    if (entry.score === null) return;
    if (previous === null || Math.abs(entry.score - previous) > 1e-9) rank = index + 1;
    entry.rank = rank; previous = entry.score;
  });
  return result;
}
