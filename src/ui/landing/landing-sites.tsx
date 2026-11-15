"use client";

// "Learn from real landings": the Moon on the left turns to the site you pick; the three site
// buttons are on the right, and a photo plus four short facts open under the one you choose.

import Image from "next/image";
import { useCallback, useLayoutEffect, useRef, useState, type PointerEvent } from "react";
import { FAMOUS_SITES, type FamousSite } from "./landing-sites-content";
import { globeRotation, lerp } from "./space-math";
import { createSpaceRenderer, type SpaceScene } from "./space-renderer";

const createSitesRenderer = (canvas: HTMLCanvasElement) => createSpaceRenderer(canvas);
import { useAnimatedCanvas } from "./use-animated-canvas";
import "./landing-sites.css";

const DEG = Math.PI / 180;
/** Resting view: slowly turning, tipped a little so the north pole shows. */
const IDLE_LATITUDE_DEG = 12;
const IDLE_TURN_DEG_PER_S = 5;
const TURN_CATCH_UP_PER_S = 3.2;
const MOON_LIGHT: [number, number, number] = [-0.55, 0.32, 0.77];

function formatCoordinates(site: FamousSite): string {
  const lat = `${Math.abs(site.latDeg).toFixed(3)}° ${site.latDeg >= 0 ? "N" : "S"}`;
  const lon = `${Math.abs(site.lonDeg).toFixed(3)}° ${site.lonDeg >= 0 ? "E" : "W"}`;
  return `${lat}, ${lon}`;
}

/** Shortest signed turn from one longitude to another, in degrees. */
function lonGap(fromDeg: number, toDeg: number): number {
  return ((toDeg - fromDeg + 540) % 360) - 180;
}

export function LandingSites() {
  const [selected, setSelected] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const markerRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const selectedRef = useRef<number | null>(null);
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);
  const viewRef = useRef({ latDeg: IDLE_LATITUDE_DEG, lonDeg: 0, lastTimeS: 0 });

  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const manual = useRef(false);
  const [dragging, setDragging] = useState(false);

  const rotate = (dx: number, dy: number) => {
    manual.current = true;
    const view = viewRef.current;
    view.lonDeg = ((view.lonDeg - dx + 540) % 360 + 360) % 360 - 180;
    view.latDeg = Math.max(-89, Math.min(89, view.latDeg + dy));
  };

  const finishDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.id !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
  };

  const choose = (index: number) => {
    const next = selected === index && !manual.current ? null : index;
    manual.current = false;
    selectedRef.current = next;
    setSelected(next);
  };

  useLayoutEffect(() => {
    if (selected === null) return;
    const item = itemRefs.current[selected];
    if (!item) return;
    const bounds = item.getBoundingClientRect();
    const topbar = document.querySelector(".lq-topbar")?.getBoundingClientRect().bottom ?? 0;
    const top = topbar + 12;
    const available = window.innerHeight - top - 12;
    if (bounds.top >= top && bounds.bottom <= window.innerHeight - 12) return;
    const distance = bounds.height <= available && bounds.top >= top
      ? bounds.bottom - window.innerHeight + 12
      : bounds.top - top;
    window.scrollBy(0, distance);
  }, [selected]);

  const buildScene = useCallback((timeS: number, widthPx: number, heightPx: number): SpaceScene => {
    const view = viewRef.current;
    const elapsedS = Math.min(Math.max(timeS - view.lastTimeS, 0), 0.1);
    view.lastTimeS = timeS;
    const site = selectedRef.current === null ? null : FAMOUS_SITES[selectedRef.current];

    // Ease towards the chosen site (or keep drifting when none is chosen) so the turn is a glide.
    const catchUp = elapsedS > 0 ? 1 - Math.exp(-elapsedS * TURN_CATCH_UP_PER_S) : 1;
    const targetLat = site ? site.latDeg : IDLE_LATITUDE_DEG;
    if (!manual.current) {
      view.latDeg = lerp(view.latDeg, targetLat, catchUp);
      if (site) view.lonDeg += lonGap(view.lonDeg, site.lonDeg) * catchUp;
      else view.lonDeg += IDLE_TURN_DEG_PER_S * elapsedS;
      view.lonDeg = ((view.lonDeg + 540) % 360) - 180;
    }

    const rotation = globeRotation(-view.lonDeg * DEG, view.latDeg * DEG, 0);
    const radiusPx = Math.min(widthPx, heightPx) * 0.44;
    const centerX = widthPx / 2;
    const centerY = heightPx / 2;

    // Pin each site on the sphere: turn its body-fixed position into view space and project it.
    FAMOUS_SITES.forEach((famous, index) => {
      const marker = markerRefs.current[index];
      if (!marker) return;
      const lat = famous.latDeg * DEG;
      const lon = famous.lonDeg * DEG;
      const body = [Math.sin(lon) * Math.cos(lat), Math.sin(lat), Math.cos(lon) * Math.cos(lat)];
      const viewX = rotation[0] * body[0] + rotation[1] * body[1] + rotation[2] * body[2];
      const viewY = rotation[3] * body[0] + rotation[4] * body[1] + rotation[5] * body[2];
      const viewZ = rotation[6] * body[0] + rotation[7] * body[1] + rotation[8] * body[2];
      marker.style.transform = `translate(${(centerX + viewX * radiusPx).toFixed(1)}px, ${(centerY - viewY * radiusPx).toFixed(1)}px)`;
      marker.style.opacity = viewZ > 0.06 ? "1" : "0";
    });

    return {
      timeS,
      starDriftPx: timeS * 1.2,
      bodies: [{ kind: "moon", xPx: centerX, yPx: centerY, radiusPx, rotation, light: MOON_LIGHT }],
    };
  }, []);

  useAnimatedCanvas(canvasRef, createSitesRenderer, buildScene, 0, true);

  return (
    <section className="lq-section lq-sites" id="landing-sites" aria-labelledby="lq-sites-heading">
      <p className="lq-kicker">Learn from real landings</p>
      <h2 id="lq-sites-heading" className="lq-section-heading">
        Three sites. Three lessons.
      </h2>
      <p className="lq-section-lead">
        Drag the Moon to look around, or choose a landing site to bring it into view.
      </p>

      <div className="lq-sites-layout">
        <div
          className={`lq-sites-moon${dragging ? " is-dragging" : ""}`}
          role="group"
          aria-label="Interactive Moon. Drag or use the arrow keys to rotate."
          tabIndex={0}
          onPointerDown={(event) => {
            if (!event.isPrimary || event.button !== 0) return;
            drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
            event.currentTarget.setPointerCapture(event.pointerId);
            setDragging(true);
          }}
          onPointerMove={(event) => {
            const pointer = drag.current;
            if (!pointer || pointer.id !== event.pointerId) return;
            const degreesPerPixel = 230 / event.currentTarget.clientWidth;
            rotate((event.clientX - pointer.x) * degreesPerPixel, (event.clientY - pointer.y) * degreesPerPixel);
            pointer.x = event.clientX;
            pointer.y = event.clientY;
          }}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
          onLostPointerCapture={finishDrag}
          onKeyDown={(event) => {
            const directions: Record<string, [number, number]> = {
              ArrowLeft: [-12, 0], ArrowRight: [12, 0], ArrowUp: [0, -12], ArrowDown: [0, 12],
            };
            const direction = directions[event.key];
            if (!direction) return;
            event.preventDefault();
            rotate(...direction);
          }}
        >
          <canvas ref={canvasRef} className="lq-space-canvas lq-sites-canvas" aria-hidden="true" />
          {FAMOUS_SITES.map((site, index) => (
            <span
              key={site.id}
              ref={(element) => {
                markerRefs.current[index] = element;
              }}
              className={`lq-site-pin${selected === index ? " is-active" : ""}`}
              aria-hidden="true"
            >
              <i />
              <b>{site.mission}</b>
            </span>
          ))}
        </div>

        <ul className="lq-site-list">
          {FAMOUS_SITES.map((site, index) => {
            const isOpen = selected === index;
            return (
              <li
                key={site.id}
                ref={(element) => { itemRefs.current[index] = element; }}
                className={`lq-site-item${isOpen ? " is-open" : ""}`}
              >
                <button
                  type="button"
                  className="lq-site-pick"
                  aria-expanded={isOpen}
                  aria-controls={`lq-site-panel-${site.id}`}
                  onClick={() => choose(index)}
                >
                  <span className="lq-site-pick-index">{String(index + 1).padStart(2, "0")}</span>
                  <span className="lq-site-pick-text">
                    <strong>{site.mission}</strong>
                    <small>{site.placeName} · {site.landed}</small>
                  </span>
                  <span className="lq-site-pick-icon" aria-hidden="true" />
                </button>
                <div className="lq-site-panel" id={`lq-site-panel-${site.id}`} role="region" aria-label={`${site.mission} details`} hidden={!isOpen}>
                  <div className="lq-site-panel-inner">
                    <figure className="lq-site-photo">
                      <Image src={site.photo.src} alt={site.photo.alt} width={1000} height={1000} sizes="(max-width: 900px) 90vw, 40vw" unoptimized />
                      <figcaption>{site.photo.caption}</figcaption>
                    </figure>
                    <dl className="lq-site-facts">
                      <div>
                        <dt>Coordinates</dt>
                        <dd className="lq-site-mono">{formatCoordinates(site)}</dd>
                      </div>
                      <div>
                        <dt>Where</dt>
                        <dd>{site.where}</dd>
                      </div>
                      <div>
                        <dt>Who</dt>
                        <dd>{site.who}</dd>
                      </div>
                      <div>
                        <dt>Purpose</dt>
                        <dd>{site.purpose}</dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <p className="lq-sites-note">Photos: NASA Lunar Reconnaissance Orbiter camera (NASA/GSFC/Arizona State University). Moon map: NASA.</p>
    </section>
  );
}
