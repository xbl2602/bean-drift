"use client";

import { useRef } from "react";
import { globeRotation, lightFromScreen } from "./space-math";
import { createSpaceRenderer, MOON_COLOR_6K_URL } from "./space-renderer";
import { useAnimatedCanvas } from "./use-animated-canvas";

const TAU = Math.PI * 2;
const EARTH_YEAR_DAYS = 365.256;
const MOON_ORBIT_DAYS = 27.322;
const YEAR_SECONDS = 180;
// Project the paths at an angle; display sizes and distances are deliberately exaggerated.
const SUN_X = 50;
const SUN_Y = 67;
const EARTH_RX = 34;
const EARTH_RY = 19;
const MOON_RX = 12;
const MOON_RY = 8;
const createRenderer = (canvas: HTMLCanvasElement) => createSpaceRenderer(canvas, { moonColorUrl: MOON_COLOR_6K_URL });

function positions(timeS: number) {
  const yearAngle = timeS * TAU / YEAR_SECONDS + 0.45;
  const monthAngle = timeS * TAU / (YEAR_SECONDS * MOON_ORBIT_DAYS / EARTH_YEAR_DAYS) - 0.85;
  const earthX = SUN_X + EARTH_RX * Math.cos(yearAngle);
  const earthY = SUN_Y - EARTH_RY * Math.sin(yearAngle);
  return {
    earthX, earthY, monthAngle,
    moonX: earthX + MOON_RX * Math.cos(monthAngle),
    moonY: earthY - MOON_RY * Math.sin(monthAngle),
  };
}
const initial = positions(0);
const LUNAR_DETAIL_LIGHT: [number, number, number] = [0.72, 0.12, 0.68];

export function ConsoleOrbit() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const earthRef = useRef<SVGGElement>(null);
  const moonRef = useRef<SVGGElement>(null);

  useAnimatedCanvas(canvasRef, createRenderer, (timeS, widthPx, heightPx) => {
    const { earthX, earthY, moonX, moonY, monthAngle } = positions(timeS);
    earthRef.current?.setAttribute("transform", `translate(${earthX} ${earthY})`);
    moonRef.current?.setAttribute("transform", `translate(${moonX} ${moonY})`);
    const radiusScale = Math.min(widthPx, heightPx) / 100;
    const body = (x: number, y: number, radius: number) => ({
      xPx: x * widthPx / 100,
      yPx: y * heightPx / 100,
      radiusPx: radius * radiusScale,
      light: lightFromScreen(x * widthPx, y * heightPx, SUN_X * widthPx, SUN_Y * heightPx, 0.45),
    });
    return {
      timeS,
      starDriftPx: 0,
      bodies: [
        { kind: "sun", ...body(SUN_X, SUN_Y, 10.3), rotation: globeRotation(0, 0, 0) },
        { kind: "earth", ...body(earthX, earthY, 5.6), rotation: globeRotation(2 + timeS * 0.18, 0.28, 0.24) },
        // One turn per orbit; the same lunar hemisphere faces Earth.
        { kind: "moon", ...body(moonX, moonY, 3.3), rotation: globeRotation(0.6 + monthAngle, 0.18, 0.1) },
        { kind: "moon", ...body(32, 22, 20), light: LUNAR_DETAIL_LIGHT, rotation: globeRotation(0.6 + monthAngle, 0.18, 0.1) },
      ],
    };
  }, 30, true);

  return (
    <div className="lq-console-track" aria-hidden="true">
      <div className="lq-console-orbit">
        <div className="lq-console-orbit-map" aria-hidden="true">
          <canvas className="lq-console-orbit-canvas" ref={canvasRef} />
          <svg viewBox="0 0 100 100">
            <g transform="translate(32 22)">
              <circle className="lq-orbit-fallback" r="20" fill="#878b91" />
            </g>
            <ellipse className="lq-console-earth-path" cx={SUN_X} cy={SUN_Y} rx={EARTH_RX} ry={EARTH_RY} />
            <g transform={`translate(${SUN_X} ${SUN_Y})`}>
              <circle className="lq-orbit-fallback" r="10.3" fill="#f8a84a" />
              <text y="14">SUN</text>
            </g>
            <g ref={earthRef} transform={`translate(${initial.earthX} ${initial.earthY})`}>
              <ellipse className="lq-console-moon-path" rx={MOON_RX} ry={MOON_RY} />
              <circle className="lq-orbit-fallback" r="5.6" fill="#468ccd" />
              <text y="9">EARTH</text>
            </g>
            <g ref={moonRef} transform={`translate(${initial.moonX} ${initial.moonY})`}>
              <circle className="lq-orbit-fallback" r="3.3" fill="#c4c8cf" />
              <text y="-5.4">MOON</text>
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}
