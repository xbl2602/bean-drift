// The "loading" animation between the landing page and the product page: a pixel-art scene in the
// style of old arcade racing games, seen from a low camera in front of the action (like a drift
// photo). Only the track and the car are drawn, on a plain dark screen. The track is not there at
// the start: it is laid down from the front of the picture towards the horizon as the show begins.
// The bean slides in from the left in a drift, throwing up tyre smoke, settles gently in the middle
// so you can see it (it flips its sunglasses up and winks; nothing shakes), then swings round and
// drifts out of the right-hand side. The page changes only once the car has completely left.
//
// Everything is drawn with whole-pixel shapes on a very small canvas (180 pixels tall) that the
// browser scales up without smoothing. No pictures are used (see docs/CREDITS.md).

import { BEAN_SPRITE, drawBean, drawCar, drawSparkle, projectCarPoint, type CarPose } from "./drift-car";
import { clamp01, disc, lerp, rect, seeded } from "./pixel-draw";

/** Roughly how long the whole show lasts (the car is gone a little after this); only used for the progress bar. */
export const SCENE_SECONDS = 4.8;
/** The page is changed only once the car has completely left the picture; this is the longest we ever wait. */
export const GIVE_UP_AT_S = 8;

const HEIGHT = 180;
const HORIZON = 62;
const BACKGROUND = "#06050f";
const REVEAL_S = 1.9; // how long the road takes to be laid out to the horizon
const CAR_Y = 134;

const ENTER_S = 1.7;
const HOLD_END_S = 3.3;
const EXIT_S = 1.4;
const GLASSES_UP = [1.95, 3.0] as const;
const WINK = [2.25, 2.65] as const;

const ease = {
  outCubic: (t: number) => 1 - (1 - t) ** 3,
  outQuad: (t: number) => 1 - (1 - t) * (1 - t),
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
};
const within = (t: number, [from, to]: readonly [number, number]) => t >= from && t <= to;

type Puff = { x: number; y: number; vx: number; vy: number; age: number; life: number; r0: number; r1: number; behind: boolean };
type Layer = { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D };

function makeLayer(width: number): Layer {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas is not available");
  return { canvas, ctx };
}

/** The road in perspective: it bends one way and then the other as it runs away to the horizon. */
function drawRoad(ctx: CanvasRenderingContext2D, width: number) {
  const rnd = seeded(11);
  for (let y = HORIZON; y < HEIGHT; y++) {
    const t = (y - HORIZON) / (HEIGHT - HORIZON); // 0 at the horizon, 1 at the front of the picture
    const u = 1 - t;
    const halfWidth = width * (0.09 + 1.15 * t);
    const centre = width / 2 + width * 0.36 * Math.sin(u * Math.PI * 1.25) * Math.pow(u, 0.8);
    const band = Math.floor((1 / (t + 0.05)) * 4) % 2;
    const kerb = Math.max(1, Math.round(halfWidth * 0.07));
    const left = Math.round(centre - halfWidth);
    const right = Math.round(centre + halfWidth);
    rect(ctx, left - kerb, y, kerb, 1, band ? "#f4f0ff" : "#d6384a");
    rect(ctx, right, y, kerb, 1, band ? "#f4f0ff" : "#d6384a");
    rect(ctx, left, y, right - left, 1, band ? "#2d2c40" : "#292839");
    if (band) rect(ctx, centre - Math.max(1, halfWidth * 0.012), y, Math.max(2, Math.round(halfWidth * 0.024)), 1, "#c9c6e6");
    for (let k = 0; k < halfWidth * 0.3; k++) {
      rect(ctx, centre + (rnd() * 2 - 1) * halfWidth, y, 1, 1, rnd() < 0.5 ? "#3b3a52" : "#1f1e30");
    }
  }
}

export class DriftScene {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly beanSprite = document.createElement("canvas");
  private readonly beanCtx: CanvasRenderingContext2D;
  private width = 320;
  private road: Layer | null = null;
  private marks: Layer | null = null;
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
    this.road = makeLayer(this.width);
    drawRoad(this.road.ctx, this.width);
    this.marks = makeLayer(this.width);
  }

  /** Where the car is and which way it points (degrees; 0 = to the right, 90 = straight at the camera). */
  private carState(t: number): { x: number; y: number; heading: number } {
    const w = this.width;
    if (t < ENTER_S) {
      // Slides in from the left, flicking its nose round towards the camera as it slows.
      const p = t / ENTER_S;
      const slide = ease.outCubic(p);
      return { x: lerp(-110, w / 2, slide), y: lerp(CAR_Y + 14, CAR_Y, slide), heading: lerp(24, 108, ease.inOutCubic(p)) };
    }
    if (t < HOLD_END_S) {
      // Parked in the middle: no wobble at all, only a slow, small settling of the nose.
      return { x: w / 2, y: CAR_Y, heading: lerp(108, 103, ease.outQuad(clamp01((t - ENTER_S) / 1.3))) };
    }
    // Leaving: speeds up along a curve that bends round to the right; the nose leads the turn.
    const u = (t - HOLD_END_S) / EXIT_S;
    const reach = (w / 2 + 210) / 1.1;
    const v = clamp01(u / 0.75);
    const x = w / 2 + reach * (0.1 * u + u * u * u);
    const y = CAR_Y + 24 * ease.outQuad(v);
    const dx = reach * (0.1 + 3 * u * u);
    const dy = u < 0.75 ? ((24 * 2 * (1 - v)) / 0.75) : 0;
    const travel = (Math.atan2(dy, dx) * 180) / Math.PI;
    const target = travel - 26 * Math.sin(Math.PI * clamp01(u * 1.15));
    return { x, y, heading: lerp(103, target, ease.inOutCubic(clamp01(u / 0.32))) };
  }

  private emitPuffs(dt: number, t: number, pose: CarPose, velocity: { x: number; y: number }) {
    const enterRate = 60 + 110 * (1 - t / ENTER_S);
    const rate = t < ENTER_S ? enterRate : t < HOLD_END_S ? lerp(70, 14, clamp01((t - ENTER_S) / 1.6)) : 150;
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
        r1: r0 + 6 + Math.floor(this.rnd() * 5),
        behind: Math.sin((pose.headingDeg * Math.PI) / 180) > 0.1,
      });
    }
    if (this.puffs.length > 420) this.puffs.splice(0, this.puffs.length - 420);
  }

  render(timeS: number) {
    const t = Math.max(timeS, 0);
    const dt = Math.min(Math.max(t - this.previous.t, 0), 0.05);
    const { ctx, road, marks } = this;
    if (!road || !marks) return;
    const car = this.carState(t);
    const velocity = dt > 0 ? { x: (car.x - this.previous.x) / dt, y: (car.y - this.previous.y) / dt } : { x: 0, y: 0 };
    const speed = Math.hypot(velocity.x, velocity.y);
    this.wheelTurn += (speed * dt) / 7;
    this.previous = { t, x: car.x, y: car.y };
    const pose: CarPose = { x: car.x, y: car.y, headingDeg: car.heading, wheelTurn: this.wheelTurn };
    if (this.goneAt === null && t > HOLD_END_S && (car.x > this.width + 150 || car.y > HEIGHT + 120)) this.goneAt = t;

    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, this.width, HEIGHT);
    // The road is laid out from the front of the picture towards the horizon.
    const top = Math.round(lerp(HEIGHT, HORIZON, ease.outCubic(clamp01(t / REVEAL_S))));
    if (top < HEIGHT) ctx.drawImage(road.canvas, 0, top, this.width, HEIGHT - top, 0, top, this.width, HEIGHT - top);

    // Tyre marks stay on the road behind the rear wheels while the car is moving.
    if (dt > 0 && speed > 25 && this.goneAt === null) {
      for (const side of [-10.8, 10.8]) {
        const [mx, my] = projectCarPoint(pose, [-14, side, 0]);
        if (my > top) rect(marks.ctx, mx, my, 2, 1, "#14131f");
      }
    }
    ctx.drawImage(marks.canvas, 0, 0);

    // Speed streaks behind the car while it is racing.
    const fast = clamp01((Math.abs(velocity.x) - 200) / 400);
    if (fast > 0) {
      ctx.fillStyle = `rgba(233,230,255,${(0.18 + 0.3 * fast).toFixed(2)})`;
      for (let i = 0; i < 7; i++) {
        const sy = car.y - 60 + this.rnd() * 80;
        ctx.fillRect(Math.round(car.x - 70 - this.rnd() * 110 * fast), Math.round(sy), Math.round(12 + this.rnd() * 30 * fast), 1);
      }
    }

    if (dt > 0) this.emitPuffs(dt, t, pose, velocity);
    this.stepPuffs(dt);
    this.drawPuffs(true);

    const glassesUp = clamp01((t - GLASSES_UP[0]) / 0.2) * (1 - clamp01((t - (GLASSES_UP[1] - 0.2)) / 0.2));
    this.beanCtx.clearRect(0, 0, BEAN_SPRITE, BEAN_SPRITE);
    drawBean(this.beanCtx, BEAN_SPRITE / 2, BEAN_SPRITE / 2, glassesUp, within(t, WINK));
    const { beanX, beanY } = drawCar(ctx, pose, this.beanSprite);
    if (within(t, [WINK[0] + 0.05, WINK[1] + 0.25])) drawSparkle(ctx, beanX + 24, beanY - 22, 4 + Math.round(Math.sin((t - WINK[0]) * 14)));
    this.drawPuffs(false);

    // Pixel progress blocks and the closing fade to black once the car has gone.
    const blocks = 14;
    for (let i = 0; i < blocks; i++) {
      const done = this.goneAt !== null || i < Math.floor(Math.min(1, t / SCENE_SECONDS) * blocks + 0.5);
      rect(ctx, this.width / 2 - blocks * 5 + i * 10, HEIGHT - 16, 8, 5, done ? "#ffe08a" : "#2b2655");
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
