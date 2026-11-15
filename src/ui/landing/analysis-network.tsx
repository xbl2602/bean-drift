"use client";

// Backdrop for the console section (decoration only, no text): a relay satellite in low lunar orbit,
// seen from a chase camera. The Moon fills the left and bottom, the Earth hangs at the upper right,
// and glowing links join the satellite to the Earth and to the surface bases it can really see.
// The picture stays pinned behind the page while you scroll through the section and dims once the
// cards arrive, so it never competes with their text. The scene itself is in lunar-orbit-scene.ts.

import { useEffect, useRef } from "react";
import { createLunarOrbitRenderer, prefetchLunarOrbitAssets } from "./lunar-orbit-scene";
import { useAnimatedCanvas } from "./use-animated-canvas";

const identity = (timeS: number) => timeS;
/** The scene is built while it is still about two screens away, so it is ready before a fast scroll arrives. */
const START_MARGIN = "220% 0px 220% 0px";

export function AnalysisNetwork() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useAnimatedCanvas(canvasRef, createLunarOrbitRenderer, identity, 40, START_MARGIN);

  // Warm the browser cache, but only once the visitor has started scrolling into the story and the
  // main thread is idle: at the very first seconds the connection belongs to the pictures they are
  // actually looking at (the hero's terrain and maps), and prefetching used to starve them.
  useEffect(() => {
    let prefetched = false;
    const start = () => {
      if (typeof window.requestIdleCallback === "function") {
        window.requestIdleCallback(prefetchLunarOrbitAssets, { timeout: 4000 });
      } else {
        prefetchLunarOrbitAssets();
      }
    };
    const onScroll = () => {
      if (prefetched || window.scrollY < window.innerHeight * 0.5) return;
      prefetched = true;
      window.removeEventListener("scroll", onScroll);
      start();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="lq-analysis-track" aria-hidden="true">
      <div className="lq-analysis-pin">
        <div className="lq-comms-stage">
          <canvas className="lq-space-canvas lq-orbit-canvas" ref={canvasRef} />
        </div>
      </div>
    </div>
  );
}
