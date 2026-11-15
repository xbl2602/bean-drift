"use client";

// Lets the landing page tell other parts of the app (the product-page preload, mostly) that the
// pictures the visitor is actually looking at have finished loading, so speculative downloads
// only start once they cannot steal bandwidth from visible content.

let resolveReady: (() => void) | null = null;
let hasResolved = false;

/** Resolves once the hero (and the rest of the first screen) has everything it needs. Never rejects. */
export const landingFirstScreenReady: Promise<void> = new Promise<void>((resolve) => {
  resolveReady = resolve;
});

/** Called by the hero renderer when its scene is fully loaded and drawing. */
export function markLandingFirstScreenReady(): void {
  if (hasResolved) return;
  hasResolved = true;
  resolveReady?.();
}
