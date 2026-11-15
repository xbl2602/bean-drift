"use client";

// Plays the pixel drift animation (drift-scene.ts) when someone clicks any link to the product page.
// The animation is a cover, not a delay: it goes on screen first, then the product page is opened
// BEHIND it once the car has parked, so the page's own start-up work (scripts, WebGL, textures)
// happens while the car sits there. The car only drives off once the page has drawn its first map
// (src/lib/handoff/map-ready-signal.ts); if the page is slow, the car just waits, for as long as it
// takes. The cover lifts after the car has gone, so nobody sees the page's own "Loading lunar maps…" veil.
// No timings are guessed from the device or the network (see handoff-timing.ts): the animation follows
// its own timeline and the page's real "ready" signal. Clicking the animation skips it at any moment.
//
// This component lives in the root layout (app/layout.tsx), not in the landing page: a page-level
// component would disappear the moment the route changes, taking the cover with it.
// Clicking the animation or pressing Esc/Enter/Space skips it. People who ask their system for less
// motion go straight to the page. Modified clicks (new tab, etc.) are left alone.

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { onceMapReady } from "@/lib/handoff/map-ready-signal";
import { CAR_LEAVES_AT_S, CAR_PARKED_AT_S, DriftScene, GIVE_UP_AT_S } from "./drift-scene";
import { sceneTimeAt } from "./handoff-timing";
import "./product-transition.css";

const FADE_OUT_MS = 350;

type Phase = "playing" | "waiting" | "lifting";

function DriftOverlay({ href, onFinished }: { href: string; onFinished: () => void }) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const skipRef = useRef<() => void>(() => undefined);
  const hasOpenedPage = useRef(false);
  const [phase, setPhase] = useState<Phase>("playing");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const openProductPage = () => {
      if (hasOpenedPage.current) return; // dev mode runs effects twice; only open the page once
      hasOpenedPage.current = true;
      router.push(href);
    };
    let scene: DriftScene;
    try {
      scene = new DriftScene(canvas);
    } catch {
      openProductPage(); // no 2D canvas: skip the show
      onFinished();
      return;
    }

    router.prefetch(href); // fetch the page's data now, so opening it a moment later is quick
    let mapReadyAtMs: number | null = null;
    let isLifted = false;
    let isWaiting = false;
    let frame = 0;
    let fadeTimer = 0;
    const stopListening = onceMapReady(() => {
      mapReadyAtMs = performance.now();
    });
    const lift = (fadeMs: number) => {
      if (isLifted) return;
      isLifted = true;
      cancelAnimationFrame(frame);
      if (fadeMs > 0) {
        setPhase("lifting");
        fadeTimer = window.setTimeout(onFinished, fadeMs);
      } else {
        onFinished();
      }
    };
    skipRef.current = () => {
      openProductPage(); // skipped before the page was opened: open it now
      lift(0);
    };

    const startMs = performance.now();
    const draw = (nowMs: number) => {
      const elapsedS = (nowMs - startMs) / 1000;
      const mapReadyAtS = mapReadyAtMs === null ? null : (mapReadyAtMs - startMs) / 1000;
      const sceneS = sceneTimeAt(elapsedS, mapReadyAtS, CAR_LEAVES_AT_S);
      scene.render(sceneS);
      if (sceneS >= CAR_PARKED_AT_S) openProductPage();
      // GIVE_UP_AT_S is the safety net in case the car never reports that it has left.
      const carHasLeft = scene.carHasLeft || sceneS >= GIVE_UP_AT_S;
      if (carHasLeft && mapReadyAtS !== null) {
        lift(FADE_OUT_MS);
        return;
      }
      if (!isWaiting && mapReadyAtS === null && sceneS >= CAR_LEAVES_AT_S) {
        isWaiting = true; // the car is parked, waiting for the page
        setPhase("waiting");
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);

    const onResize = () => scene.resize(canvas.clientWidth, canvas.clientHeight);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Enter" || event.key === " ") skipRef.current();
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(fadeTimer);
      stopListening();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKey);
    };
  }, [href, router, onFinished]);

  return (
    <div className={`lq-drift${phase === "lifting" ? " lq-drift-lifting" : ""}`} role="status" aria-live="polite" onClick={() => skipRef.current()}>
      <canvas ref={canvasRef} className="lq-drift-canvas" aria-hidden="true" />
      <p className={`lq-drift-label${phase === "waiting" ? " lq-drift-label-waiting" : ""}`}>{phase === "waiting" ? "Loading the product page… click to skip" : "Loading the product page…"}</p>
    </div>
  );
}

export function ProductTransition() {
  const router = useRouter();
  const [href, setHref] = useState<string | null>(null);
  const finish = useCallback(() => setHref(null), []); // stable, so the overlay's effect does not restart

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (window.location.pathname === "/product" || window.location.pathname.startsWith("/product/")) return; // already there
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null | undefined;
      if (!anchor || (anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || !(url.pathname === "/product" || url.pathname.startsWith("/product/"))) return;
      event.preventDefault();
      event.stopPropagation();
      const destination = `${url.pathname}${url.search}${url.hash}`;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        router.push(destination);
        return;
      }
      setHref(destination);
    };
    // Capture phase, so this runs before the link's own navigation.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [router]);

  return href ? <DriftOverlay href={href} onFinished={finish} /> : null;
}
