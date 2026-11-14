"use client";

import { useEffect, useState } from "react";
import type { PointConditions } from "@/core/types";
import { angle, DEMO_EPOCH, DEMO_SITES } from "./demo-data";

export function SiteSurvey() {
  const [results, setResults] = useState<PointConditions[]>();
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [body, setBody] = useState<"sun" | "earth">("sun");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ points: DEMO_SITES, time: DEMO_EPOCH }),
      signal: controller.signal,
    }).then(response => {
      if (!response.ok) throw new Error("Could not load sites.");
      return response.json();
    }).then(data => setResults(data.results)).catch(() => {
      if (!controller.signal.aborted) setError(true);
    });
    return () => controller.abort();
  }, [attempt]);

  const limit = Math.max(5, Math.ceil(Math.max(...(results ?? []).map(result => Math.abs(result[body].elevationDeg))) / 5) * 5);

  return (
    <div className="lq-demo lq-survey">
      <p className="lq-demo-caption">14 NOV 2026 · 12:00 UTC · REFERENCE HORIZON</p>
      {error ? (
        <button className="lq-demo-choice" type="button" onClick={() => { setError(false); setAttempt(attempt + 1); }}>Retry site data</button>
      ) : !results ? <p role="status">Loading site data…</p> : (
        <>
          <table>
            <thead><tr><th scope="col">Site</th><th scope="col">Sun</th><th scope="col">Earth</th></tr></thead>
            <tbody>{results.map((result, index) => (
              <tr key={DEMO_SITES[index].name}>
                <th scope="row">{DEMO_SITES[index].name}</th><td>{angle(result.sun.elevationDeg)}</td><td>{angle(result.earth.elevationDeg)}</td>
              </tr>
            ))}</tbody>
          </table>
          <div className="lq-chart-controls" aria-label="Chart body">
            <button className="lq-demo-choice" type="button" aria-pressed={body === "sun"} onClick={() => setBody("sun")}>Sun</button>
            <button className="lq-demo-choice" type="button" aria-pressed={body === "earth"} onClick={() => setBody("earth")}>Earth</button>
          </div>
          <div className="lq-elevation-chart" role="img" aria-label={`${body} elevation: ${results.map((result, i) => `${DEMO_SITES[i].name} ${angle(result[body].elevationDeg)}`).join(", ")}`}>
            {results.map((result, index) => {
              const value = result[body].elevationDeg;
              const width = 50 * Math.abs(value) / limit;
              return (
                <div className="lq-chart-row" key={DEMO_SITES[index].name}>
                  <span>{DEMO_SITES[index].name}</span>
                  <div className="lq-chart-track"><i style={{ left: `${value < 0 ? 50 - width : 50}%`, width: `${width}%` }} data-body={body} /></div>
                </div>
              );
            })}
            <div className="lq-chart-axis"><span>−{limit}°</span><span>0°</span><span>+{limit}°</span></div>
          </div>
        </>
      )}
    </div>
  );
}
