"use client";

// The closing scene: hold the pointer anywhere in the section to open a black hole there, let go
// and it explodes into a solar system. Drawn as ASCII art by ascii-cosmos.ts.
// Keyboard: focus the "Black hole" button, hold Space or Enter, then release.

import { useEffect, useRef, useState } from "react";
import { AsciiCosmos, type CosmosPhase } from "./ascii-cosmos";
import { CosmosDevPanel } from "./cosmos-dev-panel";
import { type CosmosParams, DEFAULT_PARAMS, loadSavedParams, saveParams } from "./cosmos-params";
import "./descent-animation.css";

const MAX_DPR = 2;
const STATUS: Record<CosmosPhase, string> = {
  idle: "HOLD ANYWHERE · RELEASE TO LAUNCH A SOLAR SYSTEM",
  holding: "BLACK HOLE FORMING · RELEASE TO EXPLODE",
  exploding: "BIG BANG",
  system: "SOLAR SYSTEM · HOLD TO COLLAPSE IT AGAIN",
};

export function DescentAnimation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keyRef = useRef<HTMLButtonElement>(null);
  const cosmosRef = useRef<AsciiCosmos | null>(null);
  const [phase, setPhase] = useState<CosmosPhase>("idle");
  const [devOpen, setDevOpen] = useState(false);
  const [params, setParams] = useState<CosmosParams>(DEFAULT_PARAMS);
  const [engine, setEngine] = useState<AsciiCosmos | null>(null);
  const [isNear, setIsNear] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const section = canvas?.closest("section");
    const ctx = canvas?.getContext("2d");
    if (!canvas || !section || !ctx) return;

    const cosmos = new AsciiCosmos();
    cosmosRef.current = cosmos;
    setEngine(cosmos);
    // The developer panel opens with ?dev on the address, or Shift+D; only then are saved slider values used.
    const openDev = () => {
      const saved = loadSavedParams();
      cosmos.setParams(saved);
      setParams(saved);
      setDevOpen(true);
    };
    if (new URLSearchParams(window.location.search).has("dev")) openDev();
    const onKey = (event: KeyboardEvent) => {
      if (!event.shiftKey || event.key.toLowerCase() !== "d" || event.ctrlKey || event.metaKey) return;
      if (event.target instanceof Element && event.target.closest("input, textarea, select")) return;
      setDevOpen((open) => {
        if (!open) openDev();
        return !open;
      });
    };
    window.addEventListener("keydown", onKey);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frameRequest = 0;
    let isVisible = false;
    let lastMs = performance.now();
    let shownPhase: CosmosPhase = "idle";
    let holdPointer: number | null = null;

    const resize = () => {
      const { width, height } = section.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cosmos.dpr = dpr;
      cosmos.resize(width, height);
      // The scene lives in the band under the headline and button.
      const button = section.querySelector<HTMLElement>(".lq-button");
      const sectionTop = section.getBoundingClientRect().top;
      const bandTop = button ? button.getBoundingClientRect().bottom - sectionTop + 26 : height * 0.5;
      cosmos.setZone(bandTop, height - 46);
      if (reducedMotion) {
        if (cosmos.phase === "idle") cosmos.showSystemNow();
        cosmos.render(ctx);
      }
    };

    const frame = (nowMs: number) => {
      frameRequest = isVisible ? requestAnimationFrame(frame) : 0;
      const stepS = Math.min((nowMs - lastMs) / 1000, 0.05);
      lastMs = nowMs;
      cosmos.step(stepS);
      cosmos.render(ctx);
      if (cosmos.phase !== shownPhase) {
        shownPhase = cosmos.phase;
        setPhase(shownPhase);
      }
    };

    const localPoint = (event: PointerEvent) => {
      const box = section.getBoundingClientRect();
      return { x: event.clientX - box.left, y: event.clientY - box.top };
    };
    const onMove = (event: PointerEvent) => {
      const point = localPoint(event);
      cosmos.pointer = { ...point, isOver: true };
      if (cosmos.phase === "holding") cosmos.anchor = { ...point };
    };
    const onLeave = () => {
      cosmos.pointer.isOver = false;
    };
    const onDown = (event: PointerEvent) => {
      if (reducedMotion || holdPointer !== null || !event.isPrimary || event.button !== 0) return;
      if (event.target instanceof Element && event.target.closest("a, button, input, select, textarea")) return;
      holdPointer = event.pointerId;
      try {
        section.setPointerCapture(event.pointerId); // keeps the hold alive if the pointer leaves the section
      } catch {
        // Not every pointer can be captured; the hold still works while the pointer stays inside.
      }
      const point = localPoint(event);
      cosmos.pointer = { ...point, isOver: true };
      cosmos.hold(point.x, point.y);
    };
    const onUp = (event: PointerEvent) => {
      if (holdPointer !== event.pointerId) return;
      holdPointer = null;
      if (event.type === "pointerup") cosmos.release();
      else cosmos.cancel();
    };
    const onBlur = () => {
      holdPointer = null;
      cosmos.cancel();
    };

    const visibility = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
      setIsNear(entry.isIntersecting);
      if (isVisible && !reducedMotion && frameRequest === 0) {
        lastMs = performance.now();
        frameRequest = requestAnimationFrame(frame);
      }
    });
    visibility.observe(section);
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(section);
    resize();

    section.addEventListener("pointermove", onMove, { passive: true });
    section.addEventListener("pointerleave", onLeave);
    section.addEventListener("pointerdown", onDown);
    section.addEventListener("pointerup", onUp);
    section.addEventListener("pointercancel", onUp);
    window.addEventListener("blur", onBlur);

    return () => {
      visibility.disconnect();
      resizeObserver.disconnect();
      section.removeEventListener("pointermove", onMove);
      section.removeEventListener("pointerleave", onLeave);
      section.removeEventListener("pointerdown", onDown);
      section.removeEventListener("pointerup", onUp);
      section.removeEventListener("pointercancel", onUp);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("keydown", onKey);
      if (frameRequest !== 0) cancelAnimationFrame(frameRequest);
      cosmosRef.current = null;
    };
  }, []);

  const holdFromKeyboard = () => {
    const cosmos = cosmosRef.current;
    if (cosmos) cosmos.hold(cosmos.width / 2, cosmos.height * 0.6);
  };
  const releaseFromKeyboard = () => cosmosRef.current?.release();

  return (
    <div className="lq-cosmos" data-state={phase}>
      <canvas ref={canvasRef} className="lq-cosmos-canvas" aria-hidden="true" />
      <button
        ref={keyRef}
        type="button"
        className="lq-cosmos-key"
        aria-label="Black hole. Hold Space or Enter, then release to explode it into a Solar System."
        onKeyDown={(event) => {
          if ((event.key !== " " && event.key !== "Enter") || event.repeat) return;
          event.preventDefault();
          holdFromKeyboard();
        }}
        onKeyUp={(event) => {
          if (event.key !== " " && event.key !== "Enter") return;
          event.preventDefault();
          releaseFromKeyboard();
        }}
        onBlur={() => cosmosRef.current?.cancel()}
      >
        Hold Space
      </button>
      <p className="lq-cosmos-status" role="status">
        {STATUS[phase]}
      </p>
      {devOpen && isNear && (
        <CosmosDevPanel
          cosmos={engine}
          params={params}
          onChange={(next) => {
            setParams(next);
            engine?.setParams(next);
            saveParams(next);
          }}
          onClose={() => setDevOpen(false)}
        />
      )}
    </div>
  );
}
