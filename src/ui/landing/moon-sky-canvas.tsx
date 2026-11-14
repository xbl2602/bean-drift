"use client";

// The animated hero background: standing on the lunar surface, watching the Sun and Earth.

import { useRef } from "react";
import { computeHeroSky, HERO_CAMERA } from "./hero-sky";
import { createSurfaceRenderer } from "./surface-renderer";
import { useAnimatedCanvas } from "./use-animated-canvas";

const createHeroRenderer = (canvas: HTMLCanvasElement) => createSurfaceRenderer(canvas, HERO_CAMERA);
/** Shadows move slowly, so 60 frames a second is plenty even on faster screens. */
const HERO_MAX_FPS = 60;

export function MoonSkyCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useAnimatedCanvas(canvasRef, createHeroRenderer, computeHeroSky, HERO_MAX_FPS);
  return <canvas ref={canvasRef} className="lq-space-canvas lq-hero-canvas" aria-hidden="true" />;
}
