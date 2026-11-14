"use client";

import { useEffect, useState } from "react";
import type { PointConditions, SkyDirection } from "@/core/types";
import { angle, DAY_MS, DEMO_EPOCH, DEMO_SITES, queryPoint } from "./demo-data";

const FIRST_DAY = Date.parse(DEMO_EPOCH);
const LAST_DAY = 28;
const SITE = DEMO_SITES[2];
const dateLabel = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

function SkyMarker({ body, direction }: { body: "sun" | "earth"; direction: SkyDirection }) {
  if (direction.elevationDeg < 0) return null;
  const left = 7 + direction.azimuthDeg / 360 * 86;
  const top = 63 - direction.elevationDeg / 90 * 55;
  return <span className="lq-sky-marker" data-body={body} style={{ left: `${left}%`, top: `${top}%` }} aria-hidden="true" />;
}

export function SkyForecast() {
  const [day, setDay] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [observation, setObservation] = useState<{ day: number; point: PointConditions }>();
  const [failedDay, setFailedDay] = useState<number>();
  const date = new Date(FIRST_DAY + day * DAY_MS);
  const selectedDate = `${dateLabel.format(date)} · 12:00 UTC`;

  useEffect(() => {
    const controller = new AbortController();
    const wait = window.setTimeout(() => {
      queryPoint(SITE, new Date(FIRST_DAY + day * DAY_MS).toISOString(), controller.signal)
        .then(point => {
          if (!controller.signal.aborted) setObservation({ day, point });
        })
        .catch(() => {
          if (!controller.signal.aborted) setFailedDay(day);
        });
    }, 100);
    return () => { window.clearTimeout(wait); controller.abort(); };
  }, [day, attempt]);

  const point = observation?.day === day ? observation.point : undefined;
  return (
    <div className="lq-demo lq-forecast">
      <div className="lq-demo-caption">APOLLO 11 · PANORAMIC SKY</div>
      <div className="lq-forecast-sky" role="img" aria-label={point ? `Sky above Apollo 11. Sun elevation ${angle(point.sun.elevationDeg)}. Earth elevation ${angle(point.earth.elevationDeg)}.` : "Lunar surface panorama"}>
        <div className="lq-forecast-horizon" aria-hidden="true" />
        {point && <><SkyMarker body="sun" direction={point.sun} /><SkyMarker body="earth" direction={point.earth} /></>}
        <div className="lq-sky-compass" aria-hidden="true"><span>N</span><span>E</span><span>S</span><span>W</span><span>N</span></div>
      </div>
      <label className="lq-forecast-time">
        <span>Drag to change the date</span><strong>{selectedDate}</strong>
        <input type="range" min="0" max={LAST_DAY} value={day} aria-valuetext={selectedDate} onChange={event => { setFailedDay(undefined); setDay(Number(event.target.value)); }} />
      </label>
      <div className="lq-sky-readings">
        {point ? <>
          <span><i data-body="sun" /> Sun {angle(point.sun.elevationDeg)}{point.sun.elevationDeg < 0 && " · below"}</span>
          <span><i data-body="earth" /> Earth {angle(point.earth.elevationDeg)}{point.earth.elevationDeg < 0 && " · below"}</span>
        </> : failedDay === day ? (
          <button className="lq-demo-choice" type="button" onClick={() => { setFailedDay(undefined); setAttempt(attempt + 1); }}>Retry sky data</button>
        ) : <span role="status">Updating sky…</span>}
      </div>
      <p className="lq-demo-caption">POSITIONS FROM EPHEMERIS · TERRAIN ILLUSTRATIVE</p>
    </div>
  );
}
