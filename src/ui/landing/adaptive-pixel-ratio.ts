// How many device pixels an animated canvas draws per CSS pixel, adapted to the screen AND the GPU.
//
// Screen: `window.devicePixelRatio` already folds in the OS display scaling (125 %, 150 % ...),
// browser zoom and high-density ("Retina") panels, so the picture follows it up to a per-canvas
// ceiling. It is re-read whenever it changes (zooming, or dragging the window to another monitor).
//
// GPU: measured, not guessed. If drawn frames keep arriving slower than about 30 per second, the
// ratio steps down (never below the screen's own resolution). Capable machines keep the sharp
// picture; weak laptops trade a little sharpness for smooth motion.

/** A gap between drawn frames above this counts as slow (below ~30 frames per second). */
const SLOW_FRAME_MS = 34;
/** Longer gaps are pauses (tab hidden, canvas scrolled away), not slow frames. */
const PAUSE_GAP_MS = 500;
/** Net slow frames (slow ones minus fast ones) before the ratio steps down. */
const SLOW_FRAMES_PER_STEP = 20;
/** Each step down keeps this share of the ratio: 2 -> 1.5 -> 1.125 -> 1. */
const STEP_FACTOR = 0.75;

export type PixelRatioLimits = {
  /** Never draw finer than this, however dense the screen: the canvas's cost ceiling. */
  maxRatio: number;
  /** While the GPU keeps up, draw at least this fine even on ordinary screens (supersampling for smoother edges). Default 1. */
  minRatio?: number;
};

export type AdaptivePixelRatio = {
  /** The ratio to size the drawing buffer with right now. */
  current: () => number;
  /** Call once per drawn frame with the frame's timestamp; may step the ratio down and call `onChange`. */
  noteFrame: (nowMs: number) => void;
  /** Stops listening for screen changes. */
  dispose: () => void;
};

/** `onChange` runs when the ratio changes (screen change or a step down): resize the drawing buffer there. */
export function createAdaptivePixelRatio(limits: PixelRatioLimits, onChange: () => void): AdaptivePixelRatio {
  const { maxRatio, minRatio = 1 } = limits;
  let gpuCeiling = Infinity; // lowered step by step when the GPU cannot keep up
  let lastFrameMs = -Infinity;
  let slowFrames = 0;

  const screenRatio = () => window.devicePixelRatio || 1;
  /** Never below what the screen shows 1:1 (below 1 only when the page is zoomed out). */
  const floor = () => Math.min(1, screenRatio());
  const current = () => {
    const wanted = Math.min(maxRatio, Math.max(minRatio, screenRatio()));
    return Math.max(floor(), Math.min(wanted, gpuCeiling));
  };

  const noteFrame = (nowMs: number) => {
    const gapMs = nowMs - lastFrameMs;
    lastFrameMs = nowMs;
    if (gapMs <= 0 || gapMs > PAUSE_GAP_MS) return;
    slowFrames = gapMs > SLOW_FRAME_MS ? slowFrames + 1 : Math.max(0, slowFrames - 1);
    if (slowFrames < SLOW_FRAMES_PER_STEP) return;
    slowFrames = 0;
    const ratio = current();
    if (ratio <= floor()) return; // already as cheap as we allow
    gpuCeiling = Math.max(floor(), ratio * STEP_FACTOR);
    onChange();
  };

  // A media query on the current density fires once when the density changes; then re-arm it.
  let densityQuery: MediaQueryList | null = null;
  const onDensityChange = () => {
    watchDensity();
    onChange();
  };
  const watchDensity = () => {
    densityQuery?.removeEventListener("change", onDensityChange);
    densityQuery = window.matchMedia(`(resolution: ${screenRatio()}dppx)`);
    densityQuery.addEventListener("change", onDensityChange);
  };
  watchDensity();

  return {
    current,
    noteFrame,
    dispose: () => densityQuery?.removeEventListener("change", onDensityChange),
  };
}
