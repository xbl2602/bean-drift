"use client";

// Plays the pixel drift animation (drift-scene.ts) when someone clicks any link to the product page,
// and goes to the page while the car is leaving. Clicking the animation skips it. People who ask their
// system for less motion go straight to the page. Modified clicks (new tab, etc.) are left alone.

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { DriftScene, NAVIGATE_AT_S, SCENE_SECONDS } from "./drift-scene";
import "./product-transition.css";

function DriftOverlay({ href }: { href: string }) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hasNavigated = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let scene: DriftScene;
    try {
      scene = new DriftScene(canvas);
    } catch {
      router.push(href); // no 2D canvas: skip the show
      return;
    }
    router.prefetch(href);
    const goNow = () => {
      if (hasNavigated.current) return;
      hasNavigated.current = true;
      router.push(href);
    };
    const startMs = performance.now();
    let frame = 0;
    const draw = (nowMs: number) => {
      const timeS = (nowMs - startMs) / 1000;
      scene.render(timeS);
      if (timeS >= NAVIGATE_AT_S) goNow();
      if (timeS < SCENE_SECONDS + 0.3) frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    const onResize = () => scene.resize(canvas.clientWidth, canvas.clientHeight);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Enter" || event.key === " ") goNow();
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKey);
    };
  }, [href, router]);

  return (
    <div
      className="lq-drift"
      role="status"
      aria-live="polite"
      onClick={() => {
        if (!hasNavigated.current) {
          hasNavigated.current = true;
          router.push(href);
        }
      }}
    >
      <canvas ref={canvasRef} className="lq-drift-canvas" aria-hidden="true" />
      <p className="lq-drift-label">Loading the product page…</p>
    </div>
  );
}

export function ProductTransition() {
  const router = useRouter();
  const [href, setHref] = useState<string | null>(null);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
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

  return href ? <DriftOverlay href={href} /> : null;
}
