"use client";
// Export Results：把候选点分析和对比下载成 CSV 或 JSON。
import { useState } from "react";
import { buildCsv, buildJson, downloadTextFile, exportFileStem, type ExportInput } from "../sites/export-results";
import { Caveat, PanelButton, PanelShell } from "./panel-shell";

interface ExportPanelProps {
  input: ExportInput;
  onAddSites: () => void;
  onClose: () => void;
}

export function ExportPanel({ input, onAddSites, onClose }: ExportPanelProps) {
  const [message, setMessage] = useState<string | null>(null);
  const analysed = input.sites.filter((site) => input.analyses[site.id] && input.analyses[site.id] !== "error").length;
  const pending = input.sites.length - analysed;

  const download = (kind: "csv" | "json") => {
    try {
      const stem = exportFileStem(input.timeMs);
      if (kind === "csv") downloadTextFile(`${stem}.csv`, "text/csv;charset=utf-8", buildCsv(input));
      else downloadTextFile(`${stem}.json`, "application/json", buildJson(input));
      setMessage(`Downloaded ${stem}.${kind}`);
    } catch {
      setMessage("The file could not be created. Please try again.");
    }
  };

  return (
    <PanelShell title="Export Results" onClose={onClose} side="right">
      {input.sites.length === 0 ? (
        <>
          <p className="text-sm text-white/75">There is nothing to export yet. Save one or more candidate sites first.</p>
          <div className="mt-3"><PanelButton primary onClick={onAddSites}>Select landing sites</PanelButton></div>
        </>
      ) : (
        <>
          <p className="text-sm text-white/80">
            {input.sites.length} candidate site{input.sites.length === 1 ? "" : "s"}, analysed for {new Date(input.timeMs).toISOString().slice(0, 16).replace("T", " ")} UTC
            {input.measurePoints.length >= 2 ? ", plus your measured path (JSON only)" : ""}.
          </p>
          {pending > 0 && <p className="mt-2 text-xs text-amber-200">{pending} site{pending === 1 ? " is" : "s are"} still loading or unavailable and will export without metrics.</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <PanelButton primary onClick={() => download("csv")}>Download CSV</PanelButton>
            <PanelButton onClick={() => download("json")}>Download JSON</PanelButton>
          </div>
          {message && <p role="status" className="mt-2 text-xs text-emerald-200">{message}</p>}
          <ul className="mt-3 list-disc space-y-1 pl-4 text-xs text-white/55">
            <li>CSV: one row per site, with units and the source of every column.</li>
            <li>JSON: the same values plus suitability weights, per-criterion scores and data sources.</li>
          </ul>
        </>
      )}
      <Caveat>Every value is labelled measured, ephemeris or model. Model values are screening estimates, not mission-grade data.</Caveat>
    </PanelShell>
  );
}
