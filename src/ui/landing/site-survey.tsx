"use client";

import { useState } from "react";
import { DEMO_EPOCH, DEMO_SITES } from "./demo-data";
import { SITE_SURVEY, SURVEY_HOURS } from "./site-survey-data";

type Metric = "sunlightWindows" | "earthVisibilityWindows";
type WindowHours = readonly [number, number];
const METRICS = [
  { id: "sunlightWindows", label: "Sunlight timeline" },
  { id: "earthVisibilityWindows", label: "Earth visibility timeline" },
] as const;
const degrees = new Intl.NumberFormat("en", { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: "always" });
const hours = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });
const date = new Intl.DateTimeFormat("en-GB", {
  day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC",
});

function totalHours(windows: readonly WindowHours[]) {
  return windows.reduce((total, [start, end]) => total + end - start, 0);
}

function atHour(offset: number) {
  return date.format(new Date(Date.parse(DEMO_EPOCH) + Math.round(offset * 60) * 60_000));
}

function describeWindows(windows: readonly WindowHours[]) {
  return windows.length ? windows.map(([start, end]) => `${atHour(start)} → ${atHour(end)} UTC`).join("; ") : "No visibility window";
}

const ridgeLeadMinutes = Math.round((SITE_SURVEY[1].earthVisibilityWindows[0][0] - SITE_SURVEY[0].earthVisibilityWindows[0][0]) * 60);
const ridgeExtraMinutes = Math.round((totalHours(SITE_SURVEY[0].earthVisibilityWindows) - totalHours(SITE_SURVEY[1].earthVisibilityWindows)) * 60);

export function SiteSurvey() {
  const [metric, setMetric] = useState<Metric>("earthVisibilityWindows");

  return (
    <div className="lq-demo lq-survey">
      <p className="lq-demo-caption">14 Nov – 14 Dec 2026 · UTC</p>
      <table>
        <thead>
          <tr>
            <th scope="col">Site</th>
            <th scope="col">Solar elevation<small>At 12:00 on 14 Nov</small></th>
            <th scope="col">Total sunlight</th>
            <th scope="col">Earth visibility windows</th>
          </tr>
        </thead>
        <tbody>
          {SITE_SURVEY.map((site, i) => (
            <tr key={DEMO_SITES[i].name}>
              <th scope="row">
                <strong>{DEMO_SITES[i].name}</strong>
                <small>{Math.abs(DEMO_SITES[i].latDeg).toFixed(2)}° {DEMO_SITES[i].latDeg < 0 ? "S" : "N"}, {DEMO_SITES[i].lonDeg.toFixed(2)}° E</small>
              </th>
              <td>{degrees.format(site.solarElevationDeg)}°</td>
              <td>{hours.format(totalHours(site.sunlightWindows))} h</td>
              <td>{site.earthVisibilityWindows.map(([start, end]) => (
                <span className="lq-survey-window" key={start}>
                  <span>{atHour(start)}</span><span> → {atHour(end)}</span>
                </span>
              ))}{site.earthVisibilityWindows.length === 0 && "None"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="lq-ridge-compare">
        <strong>Ridge A vs. B</strong> Earth comes into view about {ridgeLeadMinutes} min earlier at Ridge A and stays in view about {ridgeExtraMinutes} min longer. Both get {hours.format(totalHours(SITE_SURVEY[0].sunlightWindows))} h of modeled sunlight.
      </p>
      <div className="lq-chart-controls" role="group" aria-label="Site timeline">
        {METRICS.map(({ id, label }) => (
          <button key={id} className="lq-demo-choice" type="button" aria-pressed={metric === id} onClick={() => setMetric(id)}>{label}</button>
        ))}
      </div>
      <div className="lq-survey-timeline">
        {SITE_SURVEY.map((site, i) => {
          const windows = site[metric];
          return (
            <div className="lq-chart-row" key={DEMO_SITES[i].name}>
              <span>{DEMO_SITES[i].name}</span>
              <div className="lq-chart-track" role="img" aria-label={describeWindows(windows)} title={describeWindows(windows)}>
                {windows.map(([start, end]) => (
                  <i key={start} style={{ left: `${start / SURVEY_HOURS * 100}%`, width: `${(end - start) / SURVEY_HOURS * 100}%` }} data-body={metric === "sunlightWindows" ? "sun" : "earth"} />
                ))}
              </div>
            </div>
          );
        })}
        <div className="lq-chart-axis" aria-hidden="true"><span>14 Nov</span><span>29 Nov</span><span>14 Dec</span></div>
      </div>
      <p className="lq-survey-note">Windows are estimates from six-hour ephemeris samples using a smooth horizon. Local terrain can block visibility.</p>
    </div>
  );
}
