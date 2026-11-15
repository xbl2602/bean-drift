"use client";

// "A forecast for the Moon": an all-sky chart for Apollo 11, the view you get lying on your back
// and looking straight up (North at the top, East on the left, the horizon as the outer ring).
// The six-hour samples were captured from our own /api/point. Between samples the Sun and Earth are
// blended as 3D directions, never as raw compass angles: near the top of the sky the compass
// angle flips almost instantly, and blending it directly makes the Sun jump or sweep the wrong way.

import { type CSSProperties, useEffect, useRef, useState } from "react";
import { angle, DAY_MS } from "./demo-data";
import { FORECAST_FRAME_HOURS, FORECAST_FRAMES, FORECAST_START_UTC } from "./forecast-frames";
import { HorizonForecast } from "./horizon-forecast";
import { MoonGlobe } from "./moon-globe";

const FIRST_DAY = Date.parse(FORECAST_START_UTC);
const FRAME_DAYS = FORECAST_FRAME_HOURS / 24;
const LAST_DAY = (FORECAST_FRAMES.length - 1) * FRAME_DAYS;
const PLAY_DAYS_PER_S = 1.4;
/** Near the top of the sky the Sun sweeps across the compass in a few hours; slow playback there so it reads as one glide. */
const ZENITH_SLOW_FROM_DEG = 70;
const DOME_RADIUS = 100;
/** Apollo 11 (the forecast samples are for this site). */
const SITE = { latDeg: 0.67416, lonDeg: 23.47314 };
const DEG = Math.PI / 180;
const dateLabel = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const timeLabel = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" });

type Direction = { azimuthDeg: number; elevationDeg: number };
type Sky = { sun: Direction; earth: Direction };
type Vec3 = [number, number, number];

/** East, north, up. */
function toVector(direction: Direction): Vec3 {
  const az = direction.azimuthDeg * DEG;
  const el = direction.elevationDeg * DEG;
  return [Math.cos(el) * Math.sin(az), Math.cos(el) * Math.cos(az), Math.sin(el)];
}

function toDirection(vector: Vec3): { azimuthDeg: number; elevationDeg: number } {
  const length = Math.hypot(...vector) || 1;
  return {
    azimuthDeg: ((Math.atan2(vector[0], vector[1]) / DEG) + 360) % 360,
    elevationDeg: Math.asin(Math.max(-1, Math.min(1, vector[2] / length))) / DEG,
  };
}

/** A point part-way between two directions, found by blending the 3D vectors. */
function blendDirection(from: Direction, to: Direction, share: number) {
  const a = toVector(from);
  const b = toVector(to);
  return toDirection([a[0] + (b[0] - a[0]) * share, a[1] + (b[1] - a[1]) * share, a[2] + (b[2] - a[2]) * share]);
}

const readings: Sky[] = FORECAST_FRAMES.map(([sunAz, sunEl, earthAz, earthEl]) => ({
  sun: { azimuthDeg: sunAz, elevationDeg: sunEl },
  earth: { azimuthDeg: earthAz, elevationDeg: earthEl },
}));

function skyAtDay(day: number): Sky {
  const sample = Math.min(Math.max(day / FRAME_DAYS, 0), readings.length - 1);
  const index = Math.floor(sample);
  const before = readings[index];
  const after = readings[Math.min(index + 1, readings.length - 1)];
  const share = sample - index;
  return { sun: blendDirection(before.sun, after.sun, share), earth: blendDirection(before.earth, after.earth, share) };
}

/** Where a sky direction lands on the chart: zenith at the centre, horizon on the ring. */
function onChart(direction: { azimuthDeg: number; elevationDeg: number }): { x: number; y: number } {
  const radius = ((90 - direction.elevationDeg) / 90) * DOME_RADIUS;
  const az = direction.azimuthDeg * DEG;
  return { x: -radius * Math.sin(az), y: -radius * Math.cos(az) }; // East is on the left when looking up
}

/** The Sun's path over the whole lunar day, as dotted line pieces (only while it is above the horizon). */
function trackPathFor(body: keyof Sky): string {
  let path = "";
  let isDrawing = false;
  for (let step = 0; step <= LAST_DAY * 16; step++) {
    const direction = skyAtDay(step / 16)[body];
    if (direction.elevationDeg < 0) {
      isDrawing = false;
      continue;
    }
    const { x, y } = onChart(direction);
    path += `${isDrawing ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)} `;
    isDrawing = true;
  }
  return path;
}

const sunTrack = trackPathFor("sun");
const earthTrack = trackPathFor("earth");

export function SkyForecast() {
  const [day, setDay] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [view, setView] = useState<"horizon" | "dome">("horizon");
  const dayRef = useRef(0);

  // Animate only during playback. The slider seeks directly to the chosen time.
  useEffect(() => {
    if (!isPlaying) return;
    let frame = 0;
    let previousMs = performance.now();
    const draw = (nowMs: number) => {
      const stepS = Math.min((nowMs - previousMs) / 1000, 0.1);
      previousMs = nowMs;
      const sunHeight = skyAtDay(dayRef.current).sun.elevationDeg;
      const nearZenith = Math.min(Math.max((sunHeight - ZENITH_SLOW_FROM_DEG) / (88 - ZENITH_SLOW_FROM_DEG), 0), 1);
      const speed = PLAY_DAYS_PER_S * (1 - 0.9 * nearZenith * nearZenith * (3 - 2 * nearZenith));
      const next = Math.min(dayRef.current + speed * stepS, LAST_DAY);
      dayRef.current = next;
      setDay(next);
      if (next >= LAST_DAY) setIsPlaying(false);
      else frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [isPlaying]);

  const sky = skyAtDay(day);
  const date = new Date(FIRST_DAY + day * DAY_MS);
  const selectedDate = `${dateLabel.format(date)} · ${timeLabel.format(date)} UTC`;
  const progress = (day / LAST_DAY) * 100;
  const sun = onChart(sky.sun);
  const earth = onChart(sky.earth);
  const skyLabel = `Sky above Apollo 11. Sun elevation ${angle(sky.sun.elevationDeg)}. Earth elevation ${angle(sky.earth.elevationDeg)}.`;

  return (
    <div className="lq-demo lq-forecast">
      <div className="lq-forecast-views">
        <span className="lq-demo-caption">APOLLO 11 · TRANQUILITY BASE</span>
        <div role="group" aria-label="Sky view">
          <button className="lq-demo-choice" type="button" aria-pressed={view === "horizon"} onClick={() => setView("horizon")}>Horizon</button>
          <button className="lq-demo-choice" type="button" aria-pressed={view === "dome"} onClick={() => setView("dome")}>All sky</button>
        </div>
      </div>
      <div className="lq-forecast-sky" role="img" aria-label={skyLabel}>
        {view === "horizon" ? <HorizonForecast sky={sky} /> : (
        <svg viewBox="-128 -118 256 236" preserveAspectRatio="xMidYMid meet" className="lq-dome">
          <defs>
            <radialGradient id="lq-dome-fill" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="scale(100)">
              <stop offset="0" stopColor="#070a12" />
              <stop offset="0.85" stopColor="#05070c" />
              <stop offset="1" stopColor="#10151f" />
            </radialGradient>
            <radialGradient id="lq-sun-glow">
              <stop offset="0" stopColor="#fff6cf" />
              <stop offset="0.28" stopColor="#ffd16e" />
              <stop offset="1" stopColor="#ffb347" stopOpacity="0" />
            </radialGradient>
            <pattern id="lq-earth-skin" patternUnits="objectBoundingBox" patternContentUnits="objectBoundingBox" width="1" height="1">
              <image href="/landing/earth-blue-marble-2k.jpg" x="-0.3" y="0" width="1.6" height="1" preserveAspectRatio="xMidYMid slice" />
            </pattern>
            <clipPath id="lq-dome-clip"><circle r={DOME_RADIUS} /></clipPath>
          </defs>
          <circle r={DOME_RADIUS + 9} fill="#0b0f16" stroke="#222c3a" strokeWidth="1" />
          <circle r={DOME_RADIUS} fill="url(#lq-dome-fill)" stroke="#a9c4ea66" strokeWidth="1.2" />
          {/* Altitude rings at 30 and 60 degrees, and the four compass lines. */}
          <g stroke="#7f95b533" strokeWidth="0.6" fill="none">
            <circle r={DOME_RADIUS * (2 / 3)} />
            <circle r={DOME_RADIUS / 3} />
            <path d={`M0 ${-DOME_RADIUS}V${DOME_RADIUS}M${-DOME_RADIUS} 0H${DOME_RADIUS}`} />
          </g>
          <g className="lq-dome-labels" textAnchor="middle" fontSize="9">
            <text x="0" y={-DOME_RADIUS - 13} dominantBaseline="middle">N</text>
            <text x={-DOME_RADIUS - 14} y="0" dominantBaseline="middle">E</text>
            <text x="0" y={DOME_RADIUS + 13} dominantBaseline="middle">S</text>
            <text x={DOME_RADIUS + 14} y="0" dominantBaseline="middle">W</text>
            <text x="3" y="-1" fontSize="5.5" textAnchor="start" opacity="0.6">zenith</text>
          </g>
          <g clipPath="url(#lq-dome-clip)">
            <path d={sunTrack} className="lq-sun-track" fill="none" />
            <path d={earthTrack} className="lq-earth-track" fill="none" />
            {sky.earth.elevationDeg >= 0 && (
              <g>
                <circle cx={earth.x} cy={earth.y} r="9.5" fill="#5bb6ff22" />
                <circle cx={earth.x} cy={earth.y} r="6.2" fill="url(#lq-earth-skin)" stroke="#7bd8ff" strokeWidth="0.6" />
              </g>
            )}
            {sky.sun.elevationDeg >= 0 && (
              <g>
                <circle cx={sun.x} cy={sun.y} r="15" fill="url(#lq-sun-glow)" />
                <circle cx={sun.x} cy={sun.y} r="4.2" fill="#fff4c7" />
              </g>
            )}
          </g>
        </svg>
        )}
        {view === "dome" && <MoonGlobe sun={sky.sun} earth={sky.earth} latDeg={SITE.latDeg} lonDeg={SITE.lonDeg} />}
      </div>
      <div className="lq-forecast-time">
        <button
          type="button"
          className="lq-play"
          aria-pressed={isPlaying}
          aria-label={isPlaying ? "Pause the sky" : "Play the sky forward in time"}
          onClick={() => {
            if (!isPlaying && dayRef.current >= LAST_DAY) {
              dayRef.current = 0;
              setDay(0);
            }
            setIsPlaying(!isPlaying);
          }}
        >
          {isPlaying ? (
            <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 1.5h2.6v9H2.5zM6.9 1.5h2.6v9H6.9z" fill="currentColor" /></svg>
          ) : (
            <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.5l7 4.5-7 4.5z" fill="currentColor" /></svg>
          )}
        </button>
        <label className="lq-forecast-scrub">
          <span>Drag to change the date</span>
          <input
            type="range"
            min="0"
            max={LAST_DAY}
            step="0.01"
            value={day}
            style={{ "--lq-fill": `${progress}%` } as CSSProperties}
            aria-valuetext={selectedDate}
            onChange={(event) => {
              setIsPlaying(false);
              dayRef.current = Number(event.target.value);
              setDay(dayRef.current);
            }}
          />
        </label>
        <strong>{selectedDate}</strong>
      </div>
      <div className="lq-sky-readings">
        <span><i data-body="sun" /> Sun <b>{angle(sky.sun.elevationDeg)}</b><em>{sky.sun.elevationDeg < 0 ? "below" : ""}</em></span>
        <span><i data-body="earth" /> Earth <b>{angle(sky.earth.elevationDeg)}</b><em>{sky.earth.elevationDeg < 0 ? "below" : ""}</em></span>
      </div>
      <p className="lq-demo-caption">{view === "horizon" ? <>Simulated sky above a 1969 Apollo 11 photo. Local terrain does not affect sky visibility. Photo: Neil Armstrong / NASA.</> : "LOOKING UP · RING = HORIZON · DASHES = SUN AND EARTH PATHS · INSET = THE MOON, SITE AT CENTRE"}</p>
    </div>
  );
}
