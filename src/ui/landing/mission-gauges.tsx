"use client";

// "Track the mission clock": four ring gauges. When the card comes into view each ring sweeps
// clockwise from 12 o'clock, and its numbers (the percentage and the detail line under the label)
// count along with it up to the real values. The values are a made-up example mission.
//
// The "is-live" class is put on the chapter by scroll-story.tsx while the chapter is on screen.
// Without script, or when the chapters are shown unpinned on small screens, the final values show.

import { type CSSProperties, useEffect, useRef } from "react";

type Gauge = { label: string; percent: number; color: string; detail: (progress: number) => string; finalDetail: string };

const days = (progress: number) => Math.round(18 * progress);
const links = (progress: number) => Math.round(13 * progress);

const GAUGES: Gauge[] = [
  { label: "Mission time", percent: 60, color: "var(--lq-accent)", detail: (p) => `${days(p)} of 30 days`, finalDetail: "18 of 30 days" },
  { label: "Fuel used", percent: 42, color: "#ff9d6c", detail: (p) => `${Math.round(100 - 42 * p)}% in reserve`, finalDetail: "58% in reserve" },
  { label: "Sunlight collected", percent: 71, color: "var(--lq-sun)", detail: () => "of power target", finalDetail: "of power target" },
  { label: "Communication done", percent: 54, color: "#7bd8ff", detail: (p) => `${links(p)} of 24 Earth links`, finalDetail: "13 of 24 Earth links" },
];

const SWEEP_MS = 2000;
const STAGGER_MS = 180;
const FIRST_DELAY_MS = 250;
const ease = (t: number) => 1 - Math.pow(1 - t, 3);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function MissionGauges() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const group = root.closest(".lq-group");
    const rings = Array.from(root.querySelectorAll<HTMLElement>(".lq-gauge-ring"));
    const numbers = Array.from(root.querySelectorAll<HTMLElement>(".lq-gauge-ring strong"));
    const details = Array.from(root.querySelectorAll<HTMLElement>(".lq-gauge-detail"));
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const unpinned = window.matchMedia("(max-width: 500px), (max-height: 570px)");
    let frame = 0;
    let isRunning = false;

    const show = (index: number, progress: number) => {
      const value = GAUGES[index].percent * progress;
      rings[index]?.style.setProperty("--lq-gauge-fill", value.toFixed(2));
      if (numbers[index]) numbers[index].textContent = `${Math.round(value)}%`;
      if (details[index]) details[index].textContent = progress >= 1 ? GAUGES[index].finalDetail : GAUGES[index].detail(progress);
    };
    const showAll = (progress: number) => GAUGES.forEach((_, i) => show(i, progress));

    const run = () => {
      cancelAnimationFrame(frame);
      const startMs = performance.now();
      const tick = (nowMs: number) => {
        let finished = true;
        GAUGES.forEach((_, i) => {
          const local = clamp01((nowMs - startMs - FIRST_DELAY_MS - i * STAGGER_MS) / SWEEP_MS);
          show(i, ease(local));
          if (local < 1) finished = false;
        });
        if (!finished) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };

    const sync = () => {
      cancelAnimationFrame(frame);
      const shouldPlay = !!group && !reducedMotion && !unpinned.matches;
      if (!shouldPlay) {
        isRunning = false;
        showAll(1);
        return;
      }
      const isLive = group.classList.contains("is-live");
      if (isLive && !isRunning) run();
      if (!isLive) showAll(0);
      isRunning = isLive;
    };

    sync();
    const observer = group ? new MutationObserver(sync) : null;
    if (group) observer?.observe(group, { attributes: true, attributeFilter: ["class"] });
    unpinned.addEventListener("change", sync);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      unpinned.removeEventListener("change", sync);
    };
  }, []);

  return (
    <div ref={rootRef} className="lq-gauges">
      {GAUGES.map((gauge) => (
        <div
          key={gauge.label}
          className="lq-gauge"
          role="img"
          aria-label={`${gauge.label}: ${gauge.percent} percent, ${gauge.finalDetail}`}
        >
          <div className="lq-gauge-ring" style={{ "--lq-gauge-fill": gauge.percent, "--lq-gauge-color": gauge.color } as CSSProperties}>
            <strong aria-hidden="true">{gauge.percent}%</strong>
          </div>
          <div aria-hidden="true">
            <span className="lq-gauge-label">{gauge.label}</span>
            <span className="lq-gauge-detail">{gauge.finalDetail}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
