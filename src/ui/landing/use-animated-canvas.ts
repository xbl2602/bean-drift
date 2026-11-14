"use client";

// Shared plumbing for an animated WebGL canvas: creates the renderer, keeps it sized, runs the
// animation loop only while the canvas is on screen, and fades the canvas in once everything it
// needs has loaded. The caller only says what the scene looks like at a given moment.

import { type RefObject, useEffect, useRef } from "react";
import type { CanvasRenderer } from "./gl-utils";

export type SceneBuilder<Scene> = (timeS: number, widthPx: number, heightPx: number) => Scene;

/**
 * `createRenderer` must be a stable function (defined outside the component), because the
 * renderer is created once per mounted canvas.
 */
export function useAnimatedCanvas<Scene>(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  createRenderer: (canvas: HTMLCanvasElement) => CanvasRenderer<Scene> | null,
  buildScene: SceneBuilder<Scene>,
  maxFramesPerSecond = 0,
): void {
  const buildSceneRef = useRef(buildScene);
  useEffect(() => {
    buildSceneRef.current = buildScene;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: CanvasRenderer<Scene> | null;
    try {
      renderer = createRenderer(canvas);
    } catch (error) {
      // A GPU or driver problem: keep the plain dark background rather than breaking the page.
      console.error("Animated scene could not start:", error);
      return;
    }
    if (!renderer) return; // no WebGL2 in this browser
    const activeRenderer = renderer;

    // People who ask their system for less motion get a still scene (scroll still moves the story).
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const minFrameGapMs = maxFramesPerSecond > 0 ? 1000 / maxFramesPerSecond - 2 : 0;
    const startMs = performance.now();
    let size = activeRenderer.resize();
    let frameRequest = 0;
    let lastFrameMs = -Infinity;
    let isOnScreen = true;
    let isDisposed = false;

    const drawFrame = (nowMs: number) => {
      frameRequest = isOnScreen ? requestAnimationFrame(drawFrame) : 0;
      if (nowMs - lastFrameMs < minFrameGapMs) return; // fast screens: skip frames above the cap
      lastFrameMs = nowMs;
      const timeS = prefersReducedMotion ? 0 : (nowMs - startMs) / 1000;
      activeRenderer.render(buildSceneRef.current(timeS, size.widthPx, size.heightPx));
    };

    const resizeObserver = new ResizeObserver(() => {
      size = activeRenderer.resize();
    });
    resizeObserver.observe(canvas);

    const visibilityObserver = new IntersectionObserver(([entry]) => {
      isOnScreen = entry.isIntersecting;
      if (isOnScreen && frameRequest === 0) frameRequest = requestAnimationFrame(drawFrame);
    });
    visibilityObserver.observe(canvas);

    activeRenderer.ready
      .catch((error: unknown) => console.error("Animated scene assets failed to load:", error))
      .finally(() => {
        if (!isDisposed) canvas.classList.add("is-ready");
      });

    frameRequest = requestAnimationFrame(drawFrame);

    return () => {
      isDisposed = true;
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      if (frameRequest !== 0) cancelAnimationFrame(frameRequest);
      activeRenderer.dispose();
    };
  }, [canvasRef, createRenderer, maxFramesPerSecond]);
}
