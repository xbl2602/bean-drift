"use client";
// Compare Locations：候选点并排对比。每行一个指标，每列一个候选点；有"好坏方向"的指标标出最优值。
import type { PointAnalysis } from "../analysis/point-analysis";
import type { SiteAnalyses } from "../analysis/use-point-analysis";
import { formatLatLon } from "../moon-frames";
import type { SavedSite } from "../overlay/annotations";
import { METRIC_ROWS, SOURCE_NOTES, formatMetric, type MetricRow } from "../sites/metric-rows";
import { Caveat, PanelButton, PanelShell } from "./panel-shell";

interface ComparePanelProps {
  sites: SavedSite[];
  analyses: SiteAnalyses;
  timeMs: number;
  onAddSites: () => void;
  onExport: () => void;
  onClose: () => void;
}

const SOURCE_BADGE: Record<MetricRow["source"], string> = { measured: "NASA data", ephemeris: "ephemeris", model: "model" };

function bestSiteIds(row: MetricRow, ready: Array<{ site: SavedSite; analysis: PointAnalysis }>): Set<string> {
  if (!row.better || ready.length < 2) return new Set();
  const values = ready.map(({ analysis }) => Number(formatMetric(row, analysis)));
  const best = row.better === "higher" ? Math.max(...values) : Math.min(...values);
  // 全都一样就不标
  if (values.every((value) => value === best)) return new Set();
  return new Set(ready.filter((_, i) => values[i] === best).map(({ site }) => site.id));
}

export function ComparePanel({ sites, analyses, timeMs, onAddSites, onExport, onClose }: ComparePanelProps) {
  const ready = sites.flatMap((site) => {
    const analysis = analyses[site.id];
    return analysis && analysis !== "error" ? [{ site, analysis }] : [];
  });

  return (
    <PanelShell title="Compare Locations" onClose={onClose} wide>
      {sites.length < 2 ? (
        <div className="py-4 text-center">
          <p className="text-sm text-white/75">Save at least two candidate sites to compare them. You have {sites.length}.</p>
          <div className="mt-3"><PanelButton primary onClick={onAddSites}>Select landing sites</PanelButton></div>
        </div>
      ) : (
        <>
          <p className="text-xs text-white/55">Conditions at {new Date(timeMs).toISOString().slice(0, 16).replace("T", " ")} UTC. <span className="text-emerald-300">Green</span> marks the best value in a row.</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-max border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-[#0b0f17] py-2 pr-4 text-left text-xs font-normal text-white/45">Metric</th>
                  {sites.map((site) => (
                    <th key={site.id} className="px-3 py-2 text-right align-bottom">
                      <span className="block max-w-36 truncate font-semibold text-lime-100">{site.name}</span>
                      <span className="block font-mono text-[10px] font-normal text-white/45">{formatLatLon(site)}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {METRIC_ROWS.map((row) => {
                  const best = bestSiteIds(row, ready);
                  return (
                    <tr key={row.key} className="odd:bg-white/[0.03]">
                      <th className="sticky left-0 border-t border-white/5 bg-[#0b0f17] py-1.5 pr-4 text-left font-normal">
                        {row.label} <span className="text-white/40">({row.unit})</span>
                        <span className="ml-2 rounded-full border border-white/10 px-1.5 text-[10px] text-white/45">{SOURCE_BADGE[row.source]}</span>
                      </th>
                      {sites.map((site) => {
                        const analysis = analyses[site.id];
                        const text = analysis === "error" ? "n/a" : analysis ? formatMetric(row, analysis) : "…";
                        return (
                          <td key={site.id} className={`border-t border-white/5 px-3 py-1.5 text-right font-mono ${best.has(site.id) ? "font-semibold text-emerald-300" : "text-white/85"}`}>
                            {text}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex gap-2">
            <PanelButton primary onClick={onExport}>Export results</PanelButton>
            <PanelButton onClick={onAddSites}>Add or edit sites</PanelButton>
          </div>
          <Caveat>
            {SOURCE_NOTES.measured} {SOURCE_NOTES.ephemeris} {SOURCE_NOTES.model}
          </Caveat>
        </>
      )}
    </PanelShell>
  );
}
