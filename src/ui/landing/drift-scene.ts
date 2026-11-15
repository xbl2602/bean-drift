// The "loading" animation between the landing page and the product page: a pixel-art scene in the
// style of old arcade racing games, seen from a raised camera in front of the action (like a drift
// photo). Only the track and the car are drawn, on a plain dark screen. The track is an S: in from
// the top left, round a hairpin on the right, back across the middle, round a second hairpin on the
// left and out along the bottom to the right. It is not there at the start: it is laid down just
// ahead of the car as the car drives. The bean slides in drifting, throwing up tyre smoke, settles
// gently in the middle so you can see it (it flips its sunglasses up and winks; nothing shakes),
// then drifts through the second bend and off the right-hand side. The page changes only once the
// car has completely left the picture.
//
// Everything is drawn with whole-pixel shapes on a very small canvas (180 pixels tall) that the
// browser scales up without smoothing. No pictures are used (see docs/CREDITS.md).

import { BEAN_SPRITE, drawBean, drawCar, drawSparkle, projectCarPoint, type CarPose } from "./drift-car";
import { clamp01, disc, lerp, rect, seeded } from "./pixel-draw";

/** Roughly how long the whole show lasts (the car is gone a little after this); only used for the progress bar. */
export const SCENE_SECONDS = 5.2;
/** The page is changed only once the car has completely left the picture; this is the longest we ever wait. */
export const GIVE_UP_AT_S = 9;

const HEIGHT = 180;
const BACKGROUND = "#06050f";
const ROAD_HALF_WIDTH = 40; // the road is drawn on the ground and squashed to half height, like the car
const KERB_WIDTH = 5;
const LOOK_AHEAD_PX = 110; // how much road is laid in front of the car

const ENTER_S = 2.3;
const HOLD_END_S = 4.0;
const EXIT_S = 1.5;
/** Animation time at which the car has stopped in the middle (the product page can be opened behind the cover from here on). */
export const CAR_PARKED_AT_S = ENTER_S;
/** Animation time at which the parked car starts to leave. The cover holds the car here until the product page is ready. */
export const CAR_LEAVES_AT_S = HOLD_END_S;
const GLASSES_UP = [2.7, 3.7] as const;
const WINK = [3.0, 3.4] as const;

/** The S-shaped track, as fractions of the screen width and height. The car stops on the middle leg. */
const ROAD_POINTS: readonly (readonly [number, number])[] = [
  [-0.14, 0.2],
  [0.14, 0.2],
  [0.55, 0.2],
  [0.8, 0.24],
  [0.9, 0.36],
  [0.8, 0.5],
  [0.55, 0.52],
  [0.3, 0.52],
  [0.14, 0.6],
  [0.1, 0.72],
  [0.22, 0.84],
  [0.45, 0.84],
  [0.75, 0.84],
  [1.2, 0.86],
];

const ease = {
  outCubic: (t: number) => 1 - (1 - t) ** 3,
  outQuad: (t: number) => 1 - (1 - t) * (1 - t),
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
};
const within = (t: number, [from, to]: readonly [number, number]) => t >= from && t <= to;

type Pt = { x: number; y: number };
type Puff = { x: number; y: number; vx: number; vy: number; age: number; life: number; r0: number; r1: number; behind: boolean };
type Layer = { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D };
/** `headings` are the road's direction at each point on the ground (degrees, 0 = east, 90 = towards the camera), unwrapped so they never jump. */
type Road = { points: Pt[]; headings: number[]; startIndex: number; centerIndex: number };

function makeLayer(width: number): Layer {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas is not available");
  return { canvas, ctx };
}

/** A filled ellipse made of one-pixel-tall rows. */
function ellipse(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, color: string) {
  ctx.fillStyle = color;
  for (let dy = -Math.floor(ry); dy <= Math.floor(ry); dy++) {
    const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy / ry) ** 2)));
    ctx.fillRect(Math.round(cx) - half, Math.round(cy) + dy, half * 2 + 1, 1);
  }
}

/** The road's centre line as points one pixel apart, running a little past both ends of the screen. */
function buildRoad(width: number): Road {
  const control = ROAD_POINTS.map(([fx, fy]) => ({ x: fx * width, y: fy * HEIGHT }));
  const dense: Pt[] = [];
  for (let i = 0; i < control.length - 1; i++) {
    const p0 = control[Math.max(0, i - 1)];
    const p1 = control[i];
    const p2 = control[i + 1];
    const p3 = control[Math.min(control.length - 1, i + 2)];
    for (let k = 0; k < 60; k++) {
      const u = k / 60;
      const at = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (-a + 3 * b - 3 * c + d) * u * u * u);
      dense.push({ x: at(p0.x, p1.x, p2.x, p3.x), y: at(p0.y, p1.y, p2.y, p3.y) });
    }
  }
  dense.push(control[control.length - 1]);
  const points: Pt[] = [dense[0]];
  let carried = 0;
  for (let i = 1; i < dense.length; i++) {
    let from = dense[i - 1];
    const to = dense[i];
    let segment = Math.hypot(to.x - from.x, to.y - from.y);
    while (carried + segment >= 1) {
      const t = (1 - carried) / segment;
      from = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
      points.push(from);
      segment = Math.hypot(to.x - from.x, to.y - from.y);
      carried = 0;
    }
    carried += segment;
  }
  // Straight run-ups so the car can start and finish off screen.
  const head = points[0];
  const next = points[8];
  const tail = points[points.length - 1];
  const before = points[points.length - 9];
  const lead: Pt[] = [];
  for (let k = 120; k >= 1; k--) lead.push({ x: head.x - ((next.x - head.x) / 8) * k, y: head.y - ((next.y - head.y) / 8) * k });
  const trail: Pt[] = [];
  for (let k = 1; k <= 260; k++) trail.push({ x: tail.x + ((tail.x - before.x) / 8) * k, y: tail.y + ((tail.y - before.y) / 8) * k });
  const all = [...lead, ...points, ...trail];

  // The road's direction on the ground (the screen is the ground squashed to half height), without jumps at +-180.
  const raw = all.map((p, i) => {
    const a = all[Math.max(0, i - 6)];
    const b = all[Math.min(all.length - 1, i + 6)];
    return (Math.atan2((b.y - a.y) * 2, b.x - a.x) * 180) / Math.PI;
  });
  const headings: number[] = [];
  raw.forEach((angle, i) => {
    const previous = i === 0 ? angle : headings[i - 1];
    headings.push(angle + 360 * Math.round((previous - angle) / 360));
  });

  // The car stops on the middle leg, half way across the screen, after the first hairpin (the
  // right-most point of the upper half of the road, searched before the straight run-ups were added).
  let apex = 0;
  points.forEach((p, i) => {
    if (p.y < HEIGHT * 0.5 && p.x > points[apex].x) apex = i;
  });
  let centerIndex = apex;
  while (centerIndex < points.length - 1 && points[centerIndex].x > width / 2) centerIndex++;
  centerIndex += lead.length;
  const startIndex = all.findIndex((p) => p.x > -60);
  return { points: all, headings, startIndex: Math.max(0, startIndex), centerIndex };
}

export class DriftScene {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly beanSprite = document.createElement("canvas");
  private readonly beanCtx: CanvasRenderingContext2D;
  private width = 320;
  private road: Road = { points: [], headings: [], startIndex: 0, centerIndex: 0 };
  private layers: Record<"kerb" | "asphalt" | "detail" | "marks", Layer> | null = null;
  private stamped = 0;
  private lastIndex = 0;
  private puffs: Puff[] = [];
  private previous = { t: 0, x: 0, y: 0 };
  private wheelTurn = 0;
  private rnd = seeded(99);
  private goneAt: number | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    const beanCtx = this.beanSprite.getContext("2d");
    if (!ctx || !beanCtx) throw new Error("2D canvas is not available");
    this.ctx = ctx;
    this.beanCtx = beanCtx;
    this.beanSprite.width = this.beanSprite.height = BEAN_SPRITE;
    this.resize(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight);
  }

  /** Whether the car has completely left the picture (the page can change now). */
  get carHasLeft(): boolean {
    return this.goneAt !== null;
  }

  /** The picture is always 180 pixels tall; its width follows the screen shape. */
  resize(cssWidth: number, cssHeight: number) {
    this.width = Math.min(560, Math.max(260, Math.round((HEIGHT * cssWidth) / Math.max(cssHeight, 1))));
    this.canvas.width = this.width;
    this.canvas.height = HEIGHT;
    this.ctx.imageSmoothingEnabled = false;
    this.road = buildRoad(this.width);
    this.layers = { kerb: makeLayer(this.width), asphalt: makeLayer(this.width), detail: makeLayer(this.width), marks: makeLayer(this.width) };
    this.stamped = 0;
    this.lastIndex = this.road.startIndex;
  }

  /** Position on the road at a (fractional) index, and its direction and how sharply it is turning. */
  private roadAt(s: number): { x: number; y: number; heading: number; turn: number } {
    const { points, headings } = this.road;
    const index = Math.min(points.length - 2, Math.max(0, s));
    const i = Math.floor(index);
    const f = index - i;
    const ahead = headings[Math.min(headings.length - 1, i + 20)];
    const behind = headings[Math.max(0, i - 20)];
    return {
      x: lerp(points[i].x, points[i + 1].x, f),
      y: lerp(points[i].y, points[i + 1].y, f),
      heading: lerp(headings[i], headings[i + 1], f),
      turn: ahead - behind,
    };
  }

  /** Where the car is at a moment: on the road, pointing a little further into the bend than it travels (a drift). */
  private carState(t: number): { x: number; y: number; heading: number } {
    const { startIndex, centerIndex, points } = this.road;
    const end = points.length - 2;
    if (t < ENTER_S) {
      const p = t / ENTER_S;
      const at = this.roadAt(lerp(startIndex, centerIndex, ease.outCubic(p)));
      const slip = (28 * (1 - p) + 8) * (at.turn === 0 ? 1 : Math.sign(at.turn));
      return { x: at.x, y: at.y, heading: at.heading + slip };
    }
    const arrival = this.roadAt(centerIndex);
    if (t < HOLD_END_S) {
      // Parked: no wobble at all. The nose swings round to face the camera, then settles very slowly.
      const k = t - ENTER_S;
      const faceCamera = lerp(arrival.heading + 8 * Math.sign(arrival.turn || 1), 100, ease.inOutCubic(clamp01(k / 0.9)));
      return { x: arrival.x, y: arrival.y, heading: lerp(faceCamera, 96, ease.outQuad(clamp01((k - 0.9) / 0.8))) };
    }
    const u = (t - HOLD_END_S) / EXIT_S;
    const s = Math.min(end, centerIndex + ((end - centerIndex) / 1.2) * (0.12 * u + u * u * u));
    const at = this.roadAt(s);
    const slip = 22 * Math.sin(Math.PI * clamp01(u * 0.9)) * (at.turn === 0 ? 1 : Math.sign(at.turn));
    return { x: at.x, y: at.y, heading: lerp(96, at.heading + slip, ease.inOutCubic(clamp01(u / 0.3))) };
  }

  /** Lays down the road, a little ahead of the car, one pixel of road at a time. */
  private layRoad(untilIndex: number) {
    const layers = this.layers;
    if (!layers) return;
    const { points } = this.road;
    const rnd = seeded(5 + this.stamped);
    for (let i = this.stamped; i <= Math.min(points.length - 1, untilIndex); i++) {
      const p = points[i];
      if (p.x < -ROAD_HALF_WIDTH - 20 || p.x > this.width + ROAD_HALF_WIDTH + 20) continue;
      const outer = ROAD_HALF_WIDTH + KERB_WIDTH;
      ellipse(layers.kerb.ctx, p.x, p.y, outer, outer / 2, Math.floor(i / 8) % 2 ? "#f4f0ff" : "#f2c230");
      ellipse(layers.asphalt.ctx, p.x, p.y, ROAD_HALF_WIDTH, ROAD_HALF_WIDTH / 2, i % 24 < 12 ? "#2d2c40" : "#2a2a3c");
      if (Math.floor(i / 10) % 2 === 0) rect(layers.detail.ctx, p.x, p.y, 3, 1, "#c9c6e6");
      if (rnd() < 0.7) {
        const angle = rnd() * Math.PI * 2;
        const radius = rnd() * (ROAD_HALF_WIDTH - 4);
        rect(layers.detail.ctx, p.x + Math.cos(angle) * radius, p.y + (Math.sin(angle) * radius) / 2, 1, 1, rnd() < 0.5 ? "#3b3a52" : "#1f1e30");
      }
    }
    this.stamped = Math.max(this.stamped, untilIndex + 1);
  }

  /** Index of the road point nearest the car (searching forward from the last one found). */
  private roadIndexNear(x: number, y: number): number {
    const { points } = this.road;
    let best = this.lastIndex;
    let bestDistance = Infinity;
    for (let i = Math.max(0, this.lastIndex - 30); i < Math.min(points.length, this.lastIndex + 200); i++) {
      const d = (points[i].x - x) ** 2 + (points[i].y - y) ** 2;
      if (d < bestDistance) {
        bestDistance = d;
        best = i;
      }
    }
    this.lastIndex = best;
    return best;
  }

  private emitPuffs(dt: number, t: number, pose: CarPose, velocity: { x: number; y: number }) {
    const rate = t < ENTER_S ? 55 + 100 * (1 - t / ENTER_S) : t < HOLD_END_S ? lerp(70, 10, clamp01((t - ENTER_S) / 1.6)) : 150;
    const count = Math.floor(rate * dt + this.rnd());
    for (let i = 0; i < count; i++) {
      const side = this.rnd() < 0.5 ? -10.8 : 10.8;
      const [x, y] = projectCarPoint(pose, [-14, side, 3]);
      const r0 = 2 + Math.floor(this.rnd() * 3);
      this.puffs.push({
        x,
        y,
        vx: -velocity.x * 0.16 + (this.rnd() - 0.5) * 26,
        vy: -velocity.y * 0.16 + (this.rnd() - 0.5) * 18 - 9,
        age: 0,
        life: 1 + this.rnd() * 0.9,
        r0,
        r1: r0 + 5 + Math.floor(this.rnd() * 4),
        behind: Math.sin((pose.headingDeg * Math.PI) / 180) > -0.3,
      });
    }
    if (this.puffs.length > 420) this.puffs.splice(0, this.puffs.length - 420);
  }

  render(timeS: number) {
    const t = Math.max(timeS, 0);
    const dt = Math.min(Math.max(t - this.previous.t, 0), 0.05);
    const { ctx, layers } = this;
    if (!layers) return;
    const car = this.carState(t);
    const velocity = dt > 0 ? { x: (car.x - this.previous.x) / dt, y: (car.y - this.previous.y) / dt } : { x: 0, y: 0 };
    const speed = Math.hypot(velocity.x, velocity.y);
    this.wheelTurn += (speed * dt) / 7;
    this.previous = { t, x: car.x, y: car.y };
    const pose: CarPose = { x: car.x, y: car.y, headingDeg: car.heading, wheelTurn: this.wheelTurn };
    if (this.goneAt === null && t > HOLD_END_S && (car.x > this.width + 130 || car.y > HEIGHT + 110)) this.goneAt = t;

    // The road is laid just ahead of the car: it is not there until the car gets close.
    this.layRoad(this.roadIndexNear(car.x, car.y) + LOOK_AHEAD_PX);

    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, this.width, HEIGHT);
    ctx.drawImage(layers.kerb.canvas, 0, 0);
    ctx.drawImage(layers.asphalt.canvas, 0, 0);
    ctx.drawImage(layers.detail.canvas, 0, 0);

    // Tyre marks stay on the road behind the rear wheels while the car is moving.
    if (dt > 0 && speed > 25 && this.goneAt === null) {
      for (const side of [-10.8, 10.8]) {
        const [mx, my] = projectCarPoint(pose, [-14, side, 0]);
        rect(layers.marks.ctx, mx, my, 2, 1, "#14131f");
      }
    }
    ctx.drawImage(layers.marks.canvas, 0, 0);

    // Speed streaks behind the car while it is racing.
    const fast = clamp01((speed - 220) / 420);
    if (fast > 0) {
      ctx.fillStyle = `rgba(233,230,255,${(0.18 + 0.3 * fast).toFixed(2)})`;
      for (let i = 0; i < 7; i++) {
        ctx.fillRect(Math.round(car.x - Math.sign(velocity.x || 1) * (60 + this.rnd() * 100 * fast)), Math.round(car.y - 40 + this.rnd() * 60), Math.round(10 + this.rnd() * 26 * fast), 1);
      }
    }

    if (dt > 0) this.emitPuffs(dt, t, pose, velocity);
    this.stepPuffs(dt);
    this.drawPuffs(true);

    const glassesUp = clamp01((t - GLASSES_UP[0]) / 0.2) * (1 - clamp01((t - (GLASSES_UP[1] - 0.2)) / 0.2));
    this.beanCtx.clearRect(0, 0, BEAN_SPRITE, BEAN_SPRITE);
    drawBean(this.beanCtx, BEAN_SPRITE / 2, BEAN_SPRITE / 2, glassesUp, within(t, WINK));
    const { beanX, beanY } = drawCar(ctx, pose, this.beanSprite);
    if (within(t, [WINK[0] + 0.05, WINK[1] + 0.25])) drawSparkle(ctx, beanX + 20, beanY - 18, 4 + Math.round(Math.sin((t - WINK[0]) * 14)));
    this.drawPuffs(false);

    // Pixel progress blocks and the closing fade to black once the car has gone.
    const blocks = 14;
    for (let i = 0; i < blocks; i++) {
      const done = this.goneAt !== null || i < Math.floor(Math.min(1, t / SCENE_SECONDS) * blocks + 0.5);
      rect(ctx, this.width / 2 - blocks * 5 + i * 10, HEIGHT - 12, 8, 4, done ? "#ffe08a" : "#2b2655");
    }
    const fade = this.goneAt === null ? 0 : clamp01((t - this.goneAt) / 0.4) * 0.85;
    if (fade > 0) {
      ctx.fillStyle = `rgba(5,4,15,${fade.toFixed(2)})`;
      ctx.fillRect(0, 0, this.width, HEIGHT);
    }
  }

  private stepPuffs(dt: number) {
    for (const puff of this.puffs) {
      puff.age += dt;
      puff.x += puff.vx * dt;
      puff.y += puff.vy * dt;
      puff.vx *= Math.exp(-dt * 1.5);
      puff.vy *= Math.exp(-dt * 1.5);
    }
    this.puffs = this.puffs.filter((puff) => puff.age < puff.life);
  }

  /** Smoke in three flat tones (bright, lavender, grey-violet), swelling then shrinking away. */
  private drawPuffs(behind: boolean) {
    for (const puff of this.puffs) {
      if (puff.behind !== behind) continue;
      const k = puff.age / puff.life;
      const radius = Math.max(1, Math.round(lerp(puff.r0, puff.r1, ease.outQuad(k)) * (k > 0.7 ? 1 - (k - 0.7) / 0.5 : 1)));
      disc(this.ctx, puff.x, puff.y, radius, k < 0.35 ? "#f6f2ff" : k < 0.65 ? "#d2caef" : "#9b91c4");
      if (k < 0.55 && radius > 3) disc(this.ctx, puff.x - 1, puff.y - 1, radius - 2, "#ffffff");
    }
  }
}
