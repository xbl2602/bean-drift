// Small geometry helpers shared by the hero and the scroll story.
// View space: x to the right, y up, z towards the viewer. Screen space: y points down.

type Matrix3 = number[]; // row-major, 9 numbers

function multiply(a: Matrix3, b: Matrix3): Matrix3 {
  const out = new Array<number>(9);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      out[row * 3 + col] = a[row * 3] * b[col] + a[row * 3 + 1] * b[3 + col] + a[row * 3 + 2] * b[6 + col];
    }
  }
  return out;
}

function rotateX(angleRad: number): Matrix3 {
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);
  return [1, 0, 0, 0, c, -s, 0, s, c];
}

function rotateY(angleRad: number): Matrix3 {
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);
  return [c, 0, s, 0, 1, 0, -s, 0, c];
}

function rotateZ(angleRad: number): Matrix3 {
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);
  return [c, -s, 0, s, c, 0, 0, 0, 1];
}

/**
 * Orientation of a globe. `spinRad` turns it about its own north-south axis; `tiltRad` tips the
 * north pole towards the viewer; `rollRad` leans the axis sideways (anticlockwise on screen).
 * Returns the view -> body matrix in the column-major layout WebGL expects.
 */
export function globeRotation(spinRad: number, tiltRad: number, rollRad: number): Float32Array {
  const m = multiply(rotateY(-spinRad), multiply(rotateX(-tiltRad), rotateZ(-rollRad)));
  return new Float32Array([m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]]);
}

/**
 * Direction of sunlight for a body, from where the Sun and the body sit on screen.
 * `towardsViewer` keeps part of the lit side facing us: 0 = lit purely from the side,
 * larger = fuller phase. It is a look choice, not an ephemeris.
 */
export function lightFromScreen(
  bodyXPx: number,
  bodyYPx: number,
  sunXPx: number,
  sunYPx: number,
  towardsViewer: number,
): [number, number, number] {
  const dx = sunXPx - bodyXPx;
  const dy = bodyYPx - sunYPx; // flip: screen y is down, view y is up
  const planar = Math.hypot(dx, dy) || 1;
  const x = dx / planar;
  const y = dy / planar;
  const length = Math.hypot(1, towardsViewer);
  return [x / length, y / length, towardsViewer / length];
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

export function easeInOut(t: number): number {
  return t * t * (3 - 2 * t);
}
