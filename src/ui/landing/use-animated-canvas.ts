"use client";

// Shared plumbing for an animated WebGL canvas: creates the renderer, keeps it sized, runs the
// animation loop only while the canvas is on screen, and fades the canvas in once everything it
// needs has loaded. The caller only says what the scene looks like at a given moment.
//
// With `lazy` set, the renderer (and its large image textures) only exists while the canvas is
// within about half a screen of the viewport, so several big canvases on one page do not all hold
// their pictures in graphics memory at once.

import { type RefObject, useEffect, useRef } from "react";
import type { CanvasRenderer } from "./gl-utils";

export type SceneBuilder<Scene> = (timeS: number, widthPx: number, heightPx: number) => Scene;

const LAZY_ROOT_MARGIN = "60% 0px 60% 0px";

/**
 * `createRenderer` must be a stable function (defined outside the component), because the
 * renderer is created once per mounted canvas.
 */
export function useAnimatedCanvas<Scene>(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  createRenderer: (canvas: HTMLCanvasElement) => CanvasRenderer<Scene> | null,
  buildScene: SceneBuilder<Scene>,
  maxFramesPerSecond = 0,
  lazy = false,
): void {
  const buildSceneRef = useRef(buildScene);
  useEffect(() => {
    buildSceneRef.current = buildScene;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // People who ask their system for less motion get a still scene (scroll still moves the story).
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const minFrameGapMs = maxFramesPerSecond > 0 ? 1000 / maxFramesPerSecond - 2 : 0;
    const startMs = performance.now();

    let renderer: CanvasRenderer<Scene> | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let size = { widthPx: 0, heightPx: 0 };
    let frameRequest = 0;
    let lastFrameMs = -Infinity;
    let isOnScreen = !lazy;
    let isDisposed = false;

    const drawFrame = (nowMs: number) => {
      frameRequest = isOnScreen && renderer ? requestAnimationFrame(drawFrame) : 0;
      if (!renderer || nowMs - lastFrameMs < minFrameGapMs) return; // fast screens: skip frames above the cap
      lastFrameMs = nowMs;
      const timeS = prefersReducedMotion ? 0 : (nowMs - startMs) / 1000;
      renderer.render(buildSceneRef.current(timeS, size.widthPx, size.heightPx));
    };

    const startRenderer = () => {
      if (renderer || isDisposed) return;
      let created: CanvasRenderer<Scene> | null;
      try {
        created = createRenderer(canvas);
      } catch (error) {
        // A GPU or driver problem: keep the plain dark background rather than breaking the page.
        console.error("Animated scene could not start:", error);
        return;
      }
      if (!created) return; // no WebGL2 in this browser
      renderer = created;
      size = created.resize();
      resizeObserver = new ResizeObserver(() => {
        if (renderer) size = renderer.resize();
      });
      resizeObserver.observe(canvas);
      created.ready
        .catch((error: unknown) => console.error("Animated scene assets failed to load:", error))
        .finally(() => {
          if (!isDisposed && renderer === created) canvas.classList.add("is-ready");
        });
      if (isOnScreen && frameRequest === 0) frameRequest = requestAnimationFrame(drawFrame);
    };

    const stopRenderer = () => {
      if (frameRequest !== 0) cancelAnimationFrame(frameRequest);
      frameRequest = 0;
      resizeObserver?.disconnect();
      resizeObserver = null;
      renderer?.dispose();
      renderer = null;
      canvas.classList.remove("is-ready");
    };

    const visibilityObserver = new IntersectionObserver(([entry]) => {
      isOnScreen = entry.isIntersecting;
      if (isOnScreen && renderer && frameRequest === 0) frameRequest = requestAnimationFrame(drawFrame);
    });
    visibilityObserver.observe(canvas);

    let nearObserver: IntersectionObserver | null = null;
    if (lazy) {
      nearObserver = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) startRenderer();
          else stopRenderer();
        },
        { rootMargin: LAZY_ROOT_MARGIN },
      );
      nearObserver.observe(canvas);
    } else {
      startRenderer();
    }

    return () => {
      isDisposed = true;
      nearObserver?.disconnect();
      visibilityObserver.disconnect();
      stopRenderer();
    };
  }, [canvasRef, createRenderer, maxFramesPerSecond, lazy]);
}
