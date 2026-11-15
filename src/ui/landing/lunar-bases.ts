// The surface bases the relay satellite talks to in the console backdrop (the picture has no text,
// so names are only for readers of the code).
//
// The satellite flies a low orbit over the Moon's equator, so its ground track is the equator and
// bases within about 19 degrees of latitude can come into view. Real landing sites are used where
// there are some (coordinates from Wikipedia's "List of artificial objects on the Moon", which are in
// turn from NASA/LROC and agency sources; see docs/CREDITS.md section 5). The far side has no real
// sites on this track, so a few invented bases fill the gap; they are marked `real: false`.

export type LunarBase = { id: string; name: string; latDeg: number; lonDeg: number; real: boolean };

export const LUNAR_BASES: LunarBase[] = [
  // Near side, real.
  { id: "luna-9", name: "Luna 9", latDeg: 7.08, lonDeg: -64.37, real: true },
  { id: "luna-13", name: "Luna 13", latDeg: 18.87, lonDeg: -62.05, real: true },
  { id: "surveyor-1", name: "Surveyor 1", latDeg: -2.474, lonDeg: -43.339, real: true },
  { id: "apollo-12", name: "Apollo 12", latDeg: -3.0124, lonDeg: -23.4216, real: true },
  { id: "apollo-14", name: "Apollo 14", latDeg: -3.6453, lonDeg: -17.4714, real: true },
  { id: "surveyor-6", name: "Surveyor 6", latDeg: 0.4743, lonDeg: -1.4275, real: true },
  { id: "apollo-16", name: "Apollo 16", latDeg: -8.973, lonDeg: 15.5002, real: true },
  { id: "apollo-11", name: "Apollo 11", latDeg: 0.6741, lonDeg: 23.473, real: true },
  { id: "slim", name: "SLIM", latDeg: -13.316, lonDeg: 25.251, real: true },
  { id: "apollo-17", name: "Apollo 17", latDeg: 20.1908, lonDeg: 30.7717, real: true },
  { id: "luna-16", name: "Luna 16", latDeg: -0.68, lonDeg: 56.3, real: true },
  { id: "blue-ghost-1", name: "Blue Ghost Mission 1", latDeg: 18.5623, lonDeg: 61.8103, real: true },
  { id: "luna-24", name: "Luna 24", latDeg: 12.75, lonDeg: 62.2, real: true },
  // Far side: invented, spread out so no stretch of the track is empty for long.
  { id: "far-1", name: "Far-side base 1", latDeg: 6, lonDeg: 95, real: false },
  { id: "far-2", name: "Far-side base 2", latDeg: -9, lonDeg: 128, real: false },
  { id: "far-3", name: "Far-side base 3", latDeg: 12, lonDeg: 160, real: false },
  { id: "far-4", name: "Far-side base 4", latDeg: -4, lonDeg: -168, real: false },
  { id: "far-5", name: "Far-side base 5", latDeg: 8, lonDeg: -140, real: false },
  { id: "far-6", name: "Far-side base 6", latDeg: -11, lonDeg: -110, real: false },
];
