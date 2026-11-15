// Where the viewer stands in the hero, and how the Sun and Earth move through that sky.
//
// The ground is real (NASA LOLA, lunar south pole). The sky motion follows what really happens
// near the pole, but sped up enormously and simplified, so it is NOT an ephemeris:
//   - the Sun never climbs high; it skims along the horizon, so shadows are long and keep sweeping;
//   - the Earth hardly moves at all; it hangs in one part of the sky, slowly turning and wobbling
//     a little (the real wobble is called libration).
// The product page is where real, dated Sun and Earth positions are shown.

import { globeRotation, lerp } from "./space-math";
import type { SurfaceCamera, SurfaceScene } from "./surface-renderer";

/** Standing by the south pole and looking slightly down towards Shackleton's rim. */
export const HERO_CAMERA: SurfaceCamera = {
  xM: 0,
  zM: 0,
  eyeHeightM: 1.6,
  headingDeg: 128.5,
  pitchDeg: -4.5,
  fovDeg: 50,
};

const SUN_LAP_S = 80;
/** Share of each lap the Sun spends crossing the view; the rest (out of sight) is hurried through. */
const SUN_VISIBLE_SHARE = 0.86;
const SUN_SWEEP_DEG = 46; // how far either side of straight ahead the Sun travels
const EARTH_WOBBLE_S = 46;

export function computeHeroSky(timeS: number): SurfaceScene {
  // Sun: from the right edge of the view, low across the sky, to the left edge, dipping behind the hills.
  const lap = (0.3 + timeS / SUN_LAP_S) % 1;
  const crossing = Math.min(lap / SUN_VISIBLE_SHARE, 1);
  const sunAzimuthDeg = HERO_CAMERA.headingDeg + lerp(SUN_SWEEP_DEG, -SUN_SWEEP_DEG, crossing);
  const sunElevationDeg = lap < SUN_VISIBLE_SHARE ? -1.2 + 8.4 * Math.sin(Math.PI * crossing) : -4;

  // Earth: stays put, drifting around a small loop.
  const wobble = (timeS / EARTH_WOBBLE_S) * Math.PI * 2;
  const earthAzimuthDeg = HERO_CAMERA.headingDeg + 24 + 3.5 * Math.cos(wobble);
  const earthElevationDeg = 11.5 + 1.2 * Math.sin(wobble);

  return {
    timeS,
    starDriftPx: timeS * 0.6,
    sun: { azimuthDeg: sunAzimuthDeg, elevationDeg: sunElevationDeg, angularRadiusDeg: 0.75 },
    // Drawn about three times its true apparent size so it reads at a glance.
    earth: { azimuthDeg: earthAzimuthDeg, elevationDeg: earthElevationDeg, angularRadiusDeg: 2.9 },
    earthRotation: globeRotation(1.8 + timeS * 0.045, 0.25, 0.41),
  };
}
