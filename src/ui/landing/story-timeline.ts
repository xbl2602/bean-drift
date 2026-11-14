// Pure maths for the scroll story: given how far the user has scrolled (0..1) and the stage size,
// work out where the Moon, Earth and Sun sit and which feature cards are visible.
// No DOM or GPU access here, so the choreography can be read and tuned in one place.
//
// The story in three beats:
//   1. Moon   - rises from the bottom edge and grows to fill the stage, then steps aside.
//   2. Earth  - swings in from the far right on a curved path, passing in front of the Moon,
//               and comes to rest on the left. Afterwards it travels on to the far side of its orbit
//               (smaller, further away) instead of vanishing.
//   3. Sun    - rises at the left edge and crosses to the right. Because the Sun is the light source,
//               the lit side of the Moon and Earth turns to follow it the whole time.

import { clamp01, easeInOut, lerp } from "./space-math";

export type BodyPlacement = {
  /** Centre in px from the stage's top-left corner. */
  xPx: number;
  yPx: number;
  radiusPx: number;
};

export type StoryFrame = {
  moon: BodyPlacement;
  earth: BodyPlacement;
  /** The Sun also has a position while it is still off-screen, because it lights the other two. */
  sun: BodyPlacement;
  /** Extra turns of the Earth's own rotation caused by scrolling (it also turns slowly with time). */
  earthScrollTurns: number;
  /** True while the Earth is on the near side of its orbit and should be drawn over the Moon. */
  earthInFrontOfMoon: boolean;
  /** Visibility 0..1 of the three card groups, in chapter order (moon, earth, sun). */
  groupVisibility: [number, number, number];
  /** Which chapter the progress rail highlights; -1 before the first chapter starts. */
  activeChapter: number;
};

const NARROW_STAGE_PX = 760;

/** Progress of `p` through the window [start, end], clamped to 0..1 and eased. */
function eased(p: number, start: number, end: number): number {
  return easeInOut(clamp01((p - start) / (end - start)));
}

/** Fades in over [inStart, inEnd] and, if given, back out over [outStart, outEnd]. */
function fadeWindow(p: number, inStart: number, inEnd: number, outStart?: number, outEnd?: number): number {
  const fadeIn = eased(p, inStart, inEnd);
  if (outStart === undefined || outEnd === undefined) return fadeIn;
  return fadeIn * (1 - eased(p, outStart, outEnd));
}

export function computeStoryFrame(progress: number, stageWidthPx: number, stageHeightPx: number): StoryFrame {
  const p = clamp01(progress);
  const w = stageWidthPx;
  const h = stageHeightPx;
  const narrow = w < NARROW_STAGE_PX;

  // --- Moon: starts with only its top 20% above the bottom edge, rises and grows, then steps aside.
  const moonFullRadiusPx = (narrow ? Math.min(w * 0.8, h * 0.55) : Math.min(w * 0.6, h * 0.78)) / 2;
  const moonRise = eased(p, 0, 0.2);
  const moonStartScale = 0.55;
  const moonStartY = h + moonFullRadiusPx * 2 * moonStartScale * 0.3; // leaves 20% of the disc showing
  const moonMoveLeft = eased(p, 0.20, 0.29);
  const moonShrink = eased(p, 0.36, 0.46);
  const moonLeftX = w * (narrow ? 0.28 : 0.23);
  const moonAsideX = narrow ? w * 0.18 : w * 0.84;
  const moonAsideY = narrow ? h * 0.11 : h * 0.2;
  const moon: BodyPlacement = {
    xPx: lerp(lerp(w / 2, moonLeftX, moonMoveLeft), moonAsideX, moonShrink),
    yPx: lerp(lerp(moonStartY, h * 0.37, moonRise), moonAsideY, moonShrink),
    radiusPx: moonFullRadiusPx * lerp(moonStartScale, 1, moonRise) * lerp(1, 0.3, moonShrink),
  };

  // --- Earth: in from the right on an arc, rest on the left, then on to the far side of its orbit.
  const earthNearRadiusPx = Math.min(240, Math.max(110, w * 0.2)) / 2;
  const earthArrive = eased(p, 0.38, 0.56);
  const earthDepart = eased(p, 0.7, 0.86);
  const earthRestX = narrow ? w * 0.5 : w * 0.2;
  const earthRestY = narrow ? h * 0.2 : h * 0.5;
  const earthFarX = narrow ? w * 0.84 : w * 0.6;
  const earthFarY = narrow ? h * 0.11 : h * 0.34;
  const earthArriveX = lerp(w + earthNearRadiusPx * 2, earthRestX, earthArrive);
  const earthArriveY = lerp(narrow ? h * 0.3 : h * 0.64, earthRestY, earthArrive) - Math.sin(Math.PI * earthArrive) * h * 0.1;
  const earth: BodyPlacement = {
    xPx: lerp(earthArriveX, earthFarX, earthDepart),
    yPx: lerp(earthArriveY, earthFarY, earthDepart) - Math.sin(Math.PI * earthDepart) * h * 0.1,
    radiusPx: earthNearRadiusPx * lerp(1, 0.42, earthDepart),
  };

  // --- Sun: waits off-screen to the upper left, sinks to its entry point, then crosses to the right.
  const sunRadiusPx = Math.min(130, Math.max(48, w * 0.09));
  const sunApproach = eased(p, 0.5, 0.72);
  const sunCross = eased(p, 0.72, 0.88);
  const sunEntryX = -sunRadiusPx * 4;
  const sunEntryY = narrow ? h * 0.3 : h * 0.8;
  const sunRestX = narrow ? w * 0.5 : w * 0.8;
  const sunRestY = narrow ? h * 0.22 : h * 0.68;
  const sun: BodyPlacement = {
    xPx: lerp(lerp(-w * 0.35, sunEntryX, sunApproach), sunRestX, sunCross),
    yPx: lerp(lerp(h * 0.12, sunEntryY, sunApproach), sunRestY, sunCross) - Math.sin(Math.PI * sunCross) * h * 0.05,
    radiusPx: sunRadiusPx,
  };

  const groupVisibility: [number, number, number] = [
    fadeWindow(p, 0.2, 0.28, 0.34, 0.39),
    fadeWindow(p, 0.56, 0.64, 0.7, 0.74),
    fadeWindow(p, 0.86, 0.94),
  ];

  let activeChapter = -1;
  if (p >= 0.72) activeChapter = 2;
  else if (p >= 0.38) activeChapter = 1;
  else if (p > 0.01) activeChapter = 0;

  return {
    moon,
    earth,
    sun,
    earthScrollTurns: earthArrive * 0.9 + earthDepart * 0.6,
    earthInFrontOfMoon: p < 0.7,
    groupVisibility,
    activeChapter,
  };
}
