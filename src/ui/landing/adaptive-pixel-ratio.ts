// How many device pixels an animated canvas draws per CSS pixel, adapted to the screen AND the GPU.
//
// Screen: `window.devicePixelRatio` already folds in the OS display scaling (125 %, 150 % ...),
// browser zoom and high-density ("Retina") panels, so the picture follows it up to a per-canvas
// ceiling. It is re-checked on every drawn frame (a plain number read), so zooming or dragging the
// window to another monitor takes effect on the next frame.
//
// GPU: measured, not guessed. About once a second the average gap between drawn frames is checked;
// if it is slower than about 30 frames per second, the ratio steps down (never below the screen's
// own resolution). Capable machines keep the sharp picture; weak laptops trade a little sharpness
// for smooth motion.

/** An average gap between drawn frames above this is too slow (below ~30 frames per second). */
const SLOW_FRAME_MS = 34;
/** A single gap this long right after normal frames is a pause (tab hidden, canvas scrolled away). */
const PAUSE_GAP_MS = 500;
/** Judge the average over about a second of drawing... */
const WINDOW_MS = 1000;
/** ...and over at least a few frames, so one hiccup never decides. */
const WINDOW_MIN_FRAMES = 3;
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
  /** Call once per drawn frame with the frame's timestamp; may change the ratio and call `onChange`. */
  noteFrame: (nowMs: number) => void;
};

/** `onChange` runs when the ratio changes (screen change or a step down): resize the drawing buffer there. */
export function createAdaptivePixelRatio(limits: PixelRatioLimits, onChange: () => void): AdaptivePixelRatio {
  const { maxRatio, minRatio = 1 } = limits;
  const screenRatio = () => window.devicePixelRatio || 1;

  let gpuCeiling = Infinity; // lowered step by step when the GPU cannot keep up
  let seenScreenRatio = screenRatio();
  let lastFrameMs = -Infinity;
  let lastGapWasLong = false;
  let windowMs = 0;
  let windowFrames = 0;

  /** Never below what the screen shows 1:1 (below 1 only when the page is zoomed out). */
  const floor = () => Math.min(1, screenRatio());
  const current = () => {
    const wanted = Math.min(maxRatio, Math.max(minRatio, screenRatio()));
    return Math.max(floor(), Math.min(wanted, gpuCeiling));
  };

  const noteFrame = (nowMs: number) => {
    const screen = screenRatio();
    if (screen !== seenScreenRatio) {
      seenScreenRatio = screen;
      windowMs = 0;
      windowFrames = 0;
      onChange();
    }

    const gapMs = nowMs - lastFrameMs;
    lastFrameMs = nowMs;
    if (!(gapMs > 0)) return;
    // One long gap after normal frames is a pause; long gaps in a row mean the device is slow.
    const isLong = gapMs > PAUSE_GAP_MS;
    const isPause = isLong && !lastGapWasLong;
    lastGapWasLong = isLong;
    if (isPause) return;

    windowMs += gapMs;
    windowFrames += 1;
    if (windowMs < WINDOW_MS || windowFrames < WINDOW_MIN_FRAMES) return;
    const averageGapMs = windowMs / windowFrames;
    windowMs = 0;
    windowFrames = 0;
    if (averageGapMs <= SLOW_FRAME_MS) return;

    const ratio = current();
    if (ratio <= floor()) return; // already as cheap as we allow
    gpuCeiling = Math.max(floor(), ratio * STEP_FACTOR);
    onChange();
  };

  return { current, noteFrame };
}
