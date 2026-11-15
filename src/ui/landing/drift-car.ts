// The bean's car for the loading animation, drawn as a tiny 3D model made of flat-shaded boxes and
// panels, rotated to any heading and flattened onto the screen from a low, front-on camera. Because
// it is a model, not a few fixed pictures, the car can swing smoothly through every angle while it
// drifts (nose toward the camera, three-quarter view, side-on) and the paint stays pixel-art: every
// panel is filled with whole pixels (see pixel-draw.ts).
//
// Car axes: X runs from the tail to the nose, Y to the car's right, Z up. All sizes are in model
// units; CAR_SCALE turns them into screen pixels.

import { disc, fillPoly, rad, rect, shade } from "./pixel-draw";

export const CAR_SCALE = 1.5;
export const BEAN_SPRITE = 18;
const BEAN_SCALE = 1.5;

export type CarPose = { x: number; y: number; headingDeg: number; wheelTurn: number };

type V3 = readonly [number, number, number];
type Range = readonly [number, number];
type Part =
  | { kind: "box"; x: Range; y: Range; z: Range; color: string; layer: 0 | 1 }
  | { kind: "quad"; points: readonly [V3, V3, V3, V3]; normal: V3; color: string; layer: 0 | 1; glass?: boolean };

const BLACK = "#1b1a27";
const WHITE = "#f1eef9";
const PARTS: readonly Part[] = [
  // Body: black lower half with the white upper half, as on the classic two-tone hatchback.
  { kind: "box", x: [-22, 22], y: [-10, 10], z: [3, 9], color: BLACK, layer: 0 },
  { kind: "box", x: [-22, 22], y: [-10, 10], z: [9, 14], color: WHITE, layer: 0 },
  { kind: "box", x: [-22, -8], y: [-9.6, 9.6], z: [14, 14.8], color: WHITE, layer: 0 },
  { kind: "box", x: [8, 22], y: [-9.6, 9.6], z: [14, 14.8], color: BLACK, layer: 1 },
  { kind: "box", x: [22, 24], y: [-10, 10], z: [3, 6], color: "#2a2938", layer: 0 },
  { kind: "box", x: [-24, -22], y: [-10, 10], z: [3, 6], color: "#2a2938", layer: 0 },
  // Open cockpit, seat and a low windscreen (see-through, so the bean shows behind it).
  { kind: "quad", points: [[-8, -8, 14.3], [8, -8, 14.3], [8, 8, 14.3], [-8, 8, 14.3]], normal: [0, 0, 1], color: "#241d4a", layer: 0 },
  { kind: "box", x: [-10, -6], y: [-7.5, 7.5], z: [14, 19], color: "#3a3560", layer: 0 },
  { kind: "quad", points: [[8, -8.8, 14.5], [8, 8.8, 14.5], [6, 8.8, 19], [6, -8.8, 19]], normal: [0.9, 0, 0.45], color: "#6a5cd0", layer: 1, glass: true },
  { kind: "box", x: [5.6, 6.8], y: [-9.2, 9.2], z: [18.8, 19.8], color: BLACK, layer: 1 },
  { kind: "box", x: [6, 8], y: [10, 12], z: [15, 16.6], color: BLACK, layer: 1 },
  { kind: "box", x: [6, 8], y: [-12, -10], z: [15, 16.6], color: BLACK, layer: 1 },
  // Rear wing on two stands.
  { kind: "box", x: [-27, -21], y: [-10.5, 10.5], z: [16.6, 18], color: "#14131f", layer: 0 },
  { kind: "box", x: [-25, -23], y: [8, 9.6], z: [14, 16.6], color: "#14131f", layer: 0 },
  { kind: "box", x: [-25, -23], y: [-9.6, -8], z: [14, 16.6], color: "#14131f", layer: 0 },
  // Lights and grille.
  { kind: "box", x: [22, 23.2], y: [-9.6, -5], z: [8, 12], color: "#ffd96b", layer: 0 },
  { kind: "box", x: [22, 23.2], y: [5, 9.6], z: [8, 12], color: "#ffd96b", layer: 0 },
  { kind: "box", x: [22, 22.8], y: [-3.6, 3.6], z: [5.8, 10], color: "#0c0b14", layer: 0 },
  { kind: "box", x: [-23.2, -22], y: [-9.6, -5.4], z: [8, 11.6], color: "#d6384a", layer: 0 },
  { kind: "box", x: [-23.2, -22], y: [5.4, 9.6], z: [8, 11.6], color: "#d6384a", layer: 0 },
];

const WHEELS: readonly V3[] = [[14, 10.8, 5.5], [-14, 10.8, 5.5], [14, -10.8, 5.5], [-14, -10.8, 5.5]];

/** The three flat tones a surface can have, from how it faces the light (up, front-left, from the camera). */
const LIGHT: V3 = [-0.45, 0.55, 0.7];

type Face = { points: [number, number][]; color: string; closeness: number; layer: 0 | 1; glass: boolean };

function boxFaces(part: Extract<Part, { kind: "box" }>): { normal: V3; points: V3[] }[] {
  const [x0, x1] = part.x;
  const [y0, y1] = part.y;
  const [z0, z1] = part.z;
  return [
    { normal: [1, 0, 0], points: [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]] },
    { normal: [-1, 0, 0], points: [[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]] },
    { normal: [0, 1, 0], points: [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]] },
    { normal: [0, -1, 0], points: [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]] },
    { normal: [0, 0, 1], points: [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]] },
  ];
}

/** Where a point of the car lands on the screen. */
export function projectCarPoint(pose: CarPose, point: V3): [number, number] {
  const c = Math.cos(rad(pose.headingDeg));
  const s = Math.sin(rad(pose.headingDeg));
  const gx = point[0] * c - point[1] * s;
  const gy = point[0] * s + point[1] * c;
  return [pose.x + CAR_SCALE * gx, pose.y + CAR_SCALE * (gy * 0.5 - point[2] * 0.9)];
}

/** The bean: a round green face with sunglasses that can flip up so it can wink. */
export function drawBean(ctx: CanvasRenderingContext2D, x: number, y: number, glassesUp: number, wink: boolean) {
  disc(ctx, x, y, 7, "#46600f");
  disc(ctx, x, y, 6, "#a8c43a");
  disc(ctx, x + 2, y + 2, 4, "#8ba82c");
  rect(ctx, x - 4, y - 5, 2, 1, "#f1fa9a");
  rect(ctx, x - 3, y - 4, 1, 1, "#f1fa9a");
  if (glassesUp > 0.5) {
    rect(ctx, x - 5, y - 6, 10, 2, "#0b0b12");
    rect(ctx, x - 4, y - 6, 1, 1, "#ffffff");
    rect(ctx, x - 4, y - 2, 3, 3, "#ffffff");
    rect(ctx, x - 3, y - 1, 1, 2, "#0b0b12");
    if (wink) {
      rect(ctx, x + 1, y - 1, 3, 1, "#0b0b12");
      rect(ctx, x + 3, y - 2, 1, 1, "#0b0b12");
    } else {
      rect(ctx, x + 1, y - 2, 3, 3, "#ffffff");
      rect(ctx, x + 2, y - 1, 1, 2, "#0b0b12");
    }
  } else {
    rect(ctx, x - 5, y - 3, 10, 1, "#0b0b12");
    rect(ctx, x - 5, y - 2, 4, 3, "#0b0b12");
    rect(ctx, x + 1, y - 2, 4, 3, "#0b0b12");
    rect(ctx, x - 4, y - 2, 1, 1, "#9aa0ff");
    rect(ctx, x + 2, y - 2, 1, 1, "#9aa0ff");
  }
  rect(ctx, x - 2, y + 3, 5, 1, "#2a1a12");
  rect(ctx, x - 1, y + 4, 3, 1, "#d6455f");
  rect(ctx, x - 5, y + 2, 2, 1, "#e68b7a");
}

export function drawSparkle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  rect(ctx, x - size, y, size * 2 + 1, 1, "#fff2a8");
  rect(ctx, x, y - size, 1, size * 2 + 1, "#fff2a8");
  rect(ctx, x - 1, y - 1, 3, 3, "#ffffff");
}

/** Draws the whole car, with the bean (already drawn on `bean`, an 18 x 18 canvas) sitting in the cockpit. */
export function drawCar(ctx: CanvasRenderingContext2D, pose: CarPose, bean: HTMLCanvasElement) {
  const c = Math.cos(rad(pose.headingDeg));
  const s = Math.sin(rad(pose.headingDeg));
  const project = (p: V3) => projectCarPoint(pose, p);
  const ground = (p: V3) => [p[0] * c - p[1] * s, p[0] * s + p[1] * c] as const;

  // Shadow on the road.
  fillPoly(ctx, ([[-22, -11, 0], [22, -11, 0], [22, 11, 0], [-22, 11, 0]] as V3[]).map(project), "rgba(0,0,0,0.2)");

  const faces: Face[] = [];
  const addFace = (points: readonly V3[], normal: V3, color: string, layer: 0 | 1, glass = false) => {
    const gn = ground(normal);
    if (gn[1] * 0.5 + normal[2] * 0.9 <= 0.02) return; // facing away from the camera
    const light = Math.max(0, gn[0] * LIGHT[0] + gn[1] * LIGHT[1] + normal[2] * LIGHT[2]);
    const tone = light > 0.62 ? 1 : light > 0.3 ? 0.84 : 0.68;
    let closeness = 0;
    for (const p of points) {
      const g = ground(p);
      closeness += (g[1] * 0.5 + p[2] * 0.9) / points.length;
    }
    faces.push({ points: points.map(project), color: shade(color, tone), closeness, layer, glass });
  };
  for (const part of PARTS) {
    if (part.kind === "box") for (const face of boxFaces(part)) addFace(face.points, face.normal, part.color, part.layer);
    else addFace(part.points, part.normal, part.color, part.layer, part.glass);
  }
  const byDepth = (a: Face, b: Face) => a.closeness - b.closeness;
  const wheelFaces = WHEELS.filter((w) => Math.sign(ground([0, w[1], 0])[1]) > 0);

  // Everything behind the bean, then the near wheels, then the bean, then the parts in front of it.
  const back = faces.filter((f) => f.layer === 0).sort(byDepth);
  for (const face of back) fillPoly(ctx, face.points, face.color);
  for (const wheel of wheelFaces) {
    const [wx, wy] = project(wheel);
    const radius = Math.round(5.5 * CAR_SCALE * 0.85);
    disc(ctx, wx, wy, radius, "#0c0b14");
    disc(ctx, wx, wy, Math.round(radius * 0.55), "#6c7096");
    disc(ctx, wx, wy, Math.round(radius * 0.22), "#2d2c40");
    const spoke = pose.wheelTurn * (wheel[0] > 0 ? 1 : 1);
    for (let k = 0; k < 3; k++) {
      const a = spoke + (k * Math.PI * 2) / 3;
      rect(ctx, wx + Math.cos(a) * radius * 0.4, wy + Math.sin(a) * radius * 0.4, 1, 1, "#e9e6f6");
    }
  }
  const [bx, by] = project([-4, 0, 17.5]);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(bean, Math.round(bx - (BEAN_SPRITE * BEAN_SCALE) / 2), Math.round(by - (BEAN_SPRITE * BEAN_SCALE) / 2), BEAN_SPRITE * BEAN_SCALE, BEAN_SPRITE * BEAN_SCALE);
  for (const face of faces.filter((f) => f.layer === 1).sort(byDepth)) fillPoly(ctx, face.points, face.color, face.glass);
  return { beanX: bx, beanY: by };
}
