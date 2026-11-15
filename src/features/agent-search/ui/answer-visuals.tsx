import type { SearchResult } from "./search-client";
import { comparisonPoints, coordinates, percent, pointVisualSchema, presetsVisualSchema, timeLabel, timelineVisualSchema, type PointVisual, type TimelineVisual } from "./visual-data";
import styles from "./answer-visuals.module.css";
import { nearbyMapSchema } from "../logic/nearby-map";
import { NearbyMap } from "./nearby-map";
import type { SelectedLunarLocation } from "./lunar-search";

function Meter({ label, value }: { label: string; value: number | null }) {
  return <div className={styles.metric}><div><span>{label}</span><strong>{percent(value)}</strong></div>
    {value !== null ? <div className={styles.track} aria-hidden="true"><span style={{ width: `${value * 100}%` }} /></div> : null}</div>;
}

function Horizon({ point }: { point: PointVisual }) {
  const profile = point.provenance.terrain.status === "ok" ? point.terrain.horizonProfile : null;
  if (!profile?.length) return null;
  const heights = [...profile.map(p => p.elevationDeg), point.sun.elevationDeg, point.earth.elevationDeg, 0];
  const low = Math.max(-90, Math.floor(Math.min(...heights) / 10) * 10 - 5);
  const high = Math.min(90, Math.ceil(Math.max(...heights) / 10) * 10 + 5);
  const x = (angle: number) => 35 + angle / 360 * 260;
  const y = (angle: number) => 130 - (angle - low) / (high - low) * 110;
  const line = [...profile].sort((a, b) => a.azimuthDeg - b.azimuthDeg).map(p => `${x(p.azimuthDeg)},${y(p.elevationDeg)}`).join(" ");
  return <figure className={styles.figure}>
    <figcaption>Sky above this location</figcaption>
    <svg viewBox="0 0 320 165" role="img" aria-label={`Azimuth versus elevation. Sun ${point.sun.elevationDeg.toFixed(1)} degrees, Earth ${point.earth.elevationDeg.toFixed(1)} degrees. Terrain horizon is the gray line.`}>
      <line x1="35" x2="295" y1={y(0)} y2={y(0)} stroke="#667782" strokeDasharray="3 4" />
      <polyline points={line} fill="none" stroke="#c4d1da" strokeWidth="1.5" />
      {[0, 90, 180, 270, 360].map((angle, i) => <text key={angle} x={x(angle)} y="153" textAnchor="middle">{["N", "E", "S", "W", "N"][i]}</text>)}
      <text x="2" y="22">{high}°</text><text x="2" y="130">{low}°</text>
      <circle cx={x(point.sun.azimuthDeg)} cy={y(point.sun.elevationDeg)} r="5" fill="#f2ca72" />
      <rect x={x(point.earth.azimuthDeg) - 4} y={y(point.earth.elevationDeg) - 4} width="8" height="8" fill="#a7dfed" />
    </svg>
    <p>● Sun · ■ Earth · gray: terrain · dashed: 0°<br />Body centres, not disk sizes. Coarse terrain profile.</p>
  </figure>;
}

function PointCard({ point, number, onSelectLocation }: { point: PointVisual; number: number; onSelectLocation?: (loc: SelectedLunarLocation) => void }) {
  const annual = point.yearStats;
  const annualAvailable = point.provenance.yearStats.status === "ok" && annual.periodStartUtc && annual.periodEndUtc;
  return <section className={styles.card} aria-label={`Location ${number}`}>
    <div className={styles.kicker}>LOCATION {String(number).padStart(2, "0")}</div>
    <h4>{onSelectLocation ? <button type="button" onClick={() => onSelectLocation({ latDeg: point.position.latDeg, lonDeg: point.position.lonDeg, label: `Location ${number} (${coordinates(point.position)})` })} style={{ all: "unset", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: "3px" }}>{coordinates(point.position)} ↗</button> : coordinates(point.position)}</h4><p className={styles.note}>{timeLabel(point.timeUtc)}</p>
    <Horizon point={point} />
    <div className={styles.pair}><div>Sun elevation<strong>{point.sun.elevationDeg.toFixed(1)}°</strong></div><div>Earth elevation<strong>{point.earth.elevationDeg.toFixed(1)}°</strong></div></div>
    <p className={styles.note}>Visible disk now: Sun {percent(point.provenance.visibility.status === "ok" ? point.visibility.sun.diskVisibleFraction : null)} · Earth {percent(point.provenance.visibility.status === "ok" ? point.visibility.earth.diskVisibleFraction : null)}</p>
    <h5>Annual visibility</h5>
    <p className={styles.note}>{annualAvailable ? `${timeLabel(annual.periodStartUtc!)} → ${timeLabel(annual.periodEndUtc!)}` : "Annual statistics unavailable"}</p>
    <Meter label="Sun" value={annualAvailable ? annual.sun.visibleFraction : null} />
    <Meter label="Earth" value={annualAvailable ? annual.earth.visibleFraction : null} />
    <Meter label="Both together" value={annualAvailable ? annual.bothVisibleFraction : null} />
    <p className={styles.note}>Visibility is not a power or radio-link guarantee.</p>
  </section>;
}

function TimelineCard({ data }: { data: TimelineVisual }) {
  const start = Date.parse(data.startUtc), span = Date.parse(data.endUtc) - start;
  return <section className={styles.card}>
    <div className={styles.kicker}>VISIBILITY WINDOWS</div><h4>{coordinates(data.position)}</h4>
    <p className={styles.note}>{timeLabel(data.startUtc)} → {timeLabel(data.endUtc)}</p>
    {(["sun", "earth", "both"] as const).map((key, index) => <div className={styles.windowRow} key={key}>
      <div>{["Sun", "Earth", "Both together"][index]} <strong>{percent(data[key].visibleFraction)}</strong></div>
      <div className={styles.windowTrack} role="img" aria-label={`${key}: ${data[key].windows.length} visible windows; ${percent(data[key].visibleFraction)} of this period`}>
        {data[key].windows.map((window, i) => <span key={i} title={`${timeLabel(window.startUtc)} to ${timeLabel(window.endUtc)}`} style={{ left: `${(Date.parse(window.startUtc) - start) / span * 100}%`, width: `${(Date.parse(window.endUtc) - Date.parse(window.startUtc)) / span * 100}%` }} />)}
      </div>
    </div>)}
    <p className={styles.note}>Colored segments: visible · dark segments: not visible. All rows use the same time axis.</p>
    <details><summary>Exact window times</summary>{(["sun", "earth", "both"] as const).map(key => <div key={key}><h5>{key}</h5>{data[key].windows.length ? data[key].windows.map((window, i) => <p className={styles.note} key={i}>{timeLabel(window.startUtc)} → {timeLabel(window.endUtc)} · {window.durationH} h</p>) : <p>No visible windows in this period.</p>}</div>)}</details>
    <p className={styles.note}>{data.provenance.note}</p>
  </section>;
}

export function AnswerVisuals({ sources, onQuestion, onSelectLocation }: { sources: SearchResult["sources"]; onQuestion: (question: string) => void; onSelectLocation?: (loc: SelectedLunarLocation) => void }) {
  return <div className={styles.visuals}>{sources.map((source, index) => {
    let content;
    if (source.tool === "lunar_gazetteer") {
      const parsed = nearbyMapSchema.safeParse(source.result);
      if (parsed.success) content = <div className={styles.comparison}>{parsed.data.locations.map((location, i) => <NearbyMap key={i} location={location} onSelectLocation={onSelectLocation} />)}</div>;
    } else if (source.tool === "get_point_conditions") {
      const parsed = pointVisualSchema.safeParse(source.result);
      if (parsed.success) content = <PointCard point={parsed.data} number={1} onSelectLocation={onSelectLocation} />;
    } else if (source.tool === "compare_points") {
      const points = comparisonPoints(source.result);
      if (points.length) content = <div className={styles.comparison}>{points.map((point, i) => <PointCard key={i} point={point} number={i + 1} onSelectLocation={onSelectLocation} />)}</div>;
    } else if (source.tool === "get_point_timeline") {
      const parsed = timelineVisualSchema.safeParse(source.result);
      if (parsed.success && parsed.data.provenance.status === "ok") content = <TimelineCard data={parsed.data} />;
    } else if (source.tool === "list_presets") {
      const parsed = presetsVisualSchema.safeParse(source.result);
      if (parsed.success) content = <div className={styles.card}><div className={styles.kicker}>CHOOSE A LOCATION</div>{parsed.data.presets.map((preset, i) => <button className={styles.location} key={i} onClick={() => onQuestion(`Show Sun and Earth conditions at latitude ${preset.position.latDeg}, longitude ${preset.position.lonDeg} at 2030-01-01T12:00:00Z. Explain the main limitation.`)} type="button"><strong>{preset.name}</strong><span>{coordinates(preset.position)} ↗</span></button>)}<p className={styles.note}>Select a location to fill a question. Review the date before searching.</p></div>;
    }
    return content ? <div key={index}><p className={styles.source}>FROM STRUCTURED DATA · SOURCE #{index + 1}</p>{content}</div> : null;
  })}</div>;
}

