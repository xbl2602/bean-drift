// The "loading" animation between the landing page and the product page: a pixel-art scene in the
// style of old arcade racing games, seen from above. Only the track and the car are drawn on a plain
// dark screen. The bean drives in from the left and drifts through the first bend, laying the road
// down in front of it as it goes (the track is not there until the car reaches it), stops dead centre
// so you can see it (it flips its sunglasses up and winks), then drifts out through a second bend and
// off the right-hand side. The page changes only once the car has completely left the picture.
//
// Everything is drawn with filled rectangles on a very small canvas (180 pixels tall) that the browser
// scales up without smoothing, so every "pixel" is a crisp square. No pictures are used: the car, the
// bean, the track and the smoke are all made in code (see docs/CREDITS.md).

/** Roughly how long the whole show lasts (the car is gone a little after this); only used for the progress bar. */
export const SCENE_SECONDS = 4;
/** The page is changed only once the car has completely left the picture; this is the longest we ever wait. */
export const GIVE_UP_AT_S = 7;

const HEIGHT = 180;
const SPRITE_W = 42;
const SPRITE_H = 22;
const SPRITE_SCALE = 2;
const BEAN_SCALE = 2;
const ROAD_HALF_WIDTH = 33;
const KERB_WIDTH = 4;
const LOOK_AHEAD_PX = 80; // how much road is laid in front of the car
const BACKGROUND = "#06050f";

const ENTER_S = 1.5;
const HOLD_END_S = 2.8;
const EXIT_S = 1.25;
const GLASSES_UP = [1.7, 2.55] as const;
const WINK = [1.95, 2.3] as const;

/** Where the road goes, as fractions of the screen width and height: two bends with the car stopping in between. */
const ROAD_POINTS: readonly (readonly [number, number])[] = [
  [-0.16, 0.8],
  [0.14, 0.8],
  [0.31, 0.6],
  [0.5, 0.46], // the car stops here
  [0.69, 0.5],
  [0.84, 0.7],
  [1.16, 0.84],
];
const CENTER_POINT_INDEX = 3;

const ease = {
  outCubic: (t: number) => 1 - (1 - t) ** 3,
  outQuad: (t: number) => 1 - (1 - t) * (1 - t),
};
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const within = (t: number, [from, to]: readonly [number, number]) => t >= from && t <= to;
const rad = (deg: number) => (deg * Math.PI) / 180;

type Pt = { x: number; y: number };
type Puff = { x: number; y: number; vx: number; vy: number; age: number; life: number; r0: number; r1: number };

function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

/** A filled circle made of one-pixel-tall rows, so its edge is a staircase like a sprite. */
function disc(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  ctx.fillStyle = color;
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy) + 0.5));
    ctx.fillRect(Math.round(cx) - half, Math.round(cy) + dy, half * 2 + 1, 1);
  }
}

// ---------- the road ----------

type Road = { points: Pt[]; startIndex: number; centerIndex: number };

/** The centre line of the road as points one pixel apart, running a little past both ends of the screen. */
function buildRoad(width: number): Road {
  const control = ROAD_POINTS.map(([fx, fy]) => ({ x: fx * width, y: fy * HEIGHT }));
  const dense: Pt[] = [];
  let centerDense = -1;
  for (let i = 0; i < control.length - 1; i++) {
    const p0 = control[Math.max(0, i - 1)];
    const p1 = control[i];
    const p2 = control[i + 1];
    const p3 = control[Math.min(control.length - 1, i + 2)];
    if (i === CENTER_POINT_INDEX) centerDense = dense.length;
    for (let k = 0; k < 80; k++) {
      const u = k / 80;
      const at = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (-a + 3 * b - 3 * c + d) * u * u * u);
      dense.push({ x: at(p0.x, p1.x, p2.x, p3.x), y: at(p0.y, p1.y, p2.y, p3.y) });
    }
  }
  dense.push(control[control.length - 1]);
  // Resample at one pixel spacing.
  const points: Pt[] = [dense[0]];
  let centerIndex = 0;
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
    if (i === centerDense) centerIndex = points.length - 1;
  }
  // Straight run-ups so the car can start and finish off screen.
  const head = points[0];
  const next = points[8];
  const tail = points[points.length - 1];
  const before = points[points.length - 9];
  const lead: Pt[] = [];
  for (let k = 140; k >= 1; k--) lead.push({ x: head.x - ((next.x - head.x) / 8) * k, y: head.y - ((next.y - head.y) / 8) * k });
  const trail: Pt[] = [];
  for (let k = 1; k <= 260; k++) trail.push({ x: tail.x + ((tail.x - before.x) / 8) * k, y: tail.y + ((tail.y - before.y) / 8) * k });
  const all = [...lead, ...points, ...trail];
  const startIndex = all.findIndex((p) => p.x > -SPRITE_W * SPRITE_SCALE * 0.6);
  return { points: all, startIndex: Math.max(0, startIndex), centerIndex: centerIndex + lead.length };
}

// ---------- the car and the bean ----------

function drawBean(ctx: CanvasRenderingContext2D, x: number, y: number, glassesUp: number, wink: boolean) {
  disc(ctx, x, y, 7, "#46600f");
  disc(ctx, x, y, 6, "#a8c43a");
  disc(ctx, x + 2, y + 2, 4, "#8ba82c");
  rect(ctx, x - 4, y - 5, 2, 1, "#f1fa9a");
  rect(ctx, x - 3, y - 4, 1, 1, "#f1fa9a");
  if (glassesUp > 0.5) {
    // Sunglasses pushed up on the forehead, eyes showing, one of them winking.
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
  // Open, happy mouth and a blush.
  rect(ctx, x - 2, y + 3, 5, 1, "#2a1a12");
  rect(ctx, x - 1, y + 4, 3, 1, "#d6455f");
  rect(ctx, x - 5, y + 2, 2, 1, "#e68b7a");
}

/** The car seen from above, facing right: wheels, white body, black hood, open cockpit, spoiler. */
function drawCar(ctx: CanvasRenderingContext2D, wheelTurn: number) {
  ctx.clearRect(0, 0, SPRITE_W, SPRITE_H);
  rect(ctx, 5, 5, 34, 16, "rgba(0,0,0,0.32)"); // soft shadow
  // Wheels, with a tread mark that turns.
  const tread = Math.floor(wheelTurn * 2) % 4;
  for (const [wx, wy] of [[8, 1], [28, 1], [8, 17], [28, 17]] as const) {
    rect(ctx, wx, wy, 9, 4, "#0c0b14");
    rect(ctx, wx + 1 + tread * 2, wy + 1, 1, 2, "#3a3a52");
    rect(ctx, wx + 4, wy + 1, 2, 2, "#6c7096");
  }
  // Body.
  rect(ctx, 6, 3, 30, 16, "#f1eef9");
  rect(ctx, 4, 5, 34, 12, "#f1eef9");
  rect(ctx, 5, 4, 32, 14, "#f1eef9");
  rect(ctx, 4, 16, 34, 1, "#c3bfd8");
  rect(ctx, 4, 5, 34, 1, "#c3bfd8");
  // Black hood with a raised centre line, and the headlights.
  rect(ctx, 27, 5, 10, 12, "#1b1a27");
  rect(ctx, 27, 10, 10, 2, "#34334a");
  rect(ctx, 37, 5, 2, 3, "#ffd96b");
  rect(ctx, 37, 14, 2, 3, "#ffd96b");
  rect(ctx, 37, 6, 1, 1, "#ffffff");
  rect(ctx, 37, 15, 1, 1, "#ffffff");
  // Cockpit and windscreen.
  rect(ctx, 12, 5, 11, 12, "#241d4a");
  rect(ctx, 23, 5, 3, 12, "#4a3d96");
  rect(ctx, 24, 6, 1, 4, "#8b7fe0");
  rect(ctx, 8, 5, 3, 12, "#e9e6f6");
  // Mirrors, spoiler, tail lights.
  rect(ctx, 24, 2, 3, 2, "#1b1a27");
  rect(ctx, 24, 18, 3, 2, "#1b1a27");
  rect(ctx, 1, 3, 4, 16, "#14131f");
  rect(ctx, 5, 6, 2, 2, "#14131f");
  rect(ctx, 5, 14, 2, 2, "#14131f");
  rect(ctx, 4, 5, 1, 3, "#d6384a");
  rect(ctx, 4, 14, 1, 3, "#d6384a");
}

function drawSparkle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  rect(ctx, x - size, y, size * 2 + 1, 1, "#fff2a8");
  rect(ctx, x, y - size, 1, size * 2 + 1, "#fff2a8");
  rect(ctx, x - 1, y - 1, 3, 3, "#ffffff");
}

type Layer = { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D };

function makeLayer(width: number): Layer {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas is not available");
  return { canvas, ctx };
}

export class DriftScene {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly carSprite = document.createElement("canvas");
  private readonly carCtx: CanvasRenderingContext2D;
  private readonly beanSprite = document.createElement("canvas");
  private readonly beanCtx: CanvasRenderingContext2D;
  private width = 320;
  private road: Road = { points: [], startIndex: 0, centerIndex: 0 };
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
    const carCtx = this.carSprite.getContext("2d");
    const beanCtx = this.beanSprite.getContext("2d");
    if (!ctx || !carCtx || !beanCtx) throw new Error("2D canvas is not available");
    this.ctx = ctx;
    this.carCtx = carCtx;
    this.beanCtx = beanCtx;
    this.carSprite.width = SPRITE_W;
    this.carSprite.height = SPRITE_H;
    this.beanSprite.width = this.beanSprite.height = 18;
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

  private roadAt(s: number): { x: number; y: number; heading: number; turn: number } {
    const { points } = this.road;
    const index = Math.min(points.length - 2, Math.max(0, s));
    const i = Math.floor(index);
    const f = index - i;
    const a = points[i];
    const b = points[i + 1];
    const ahead = points[Math.min(points.length - 1, i + 5)];
    const behind = points[Math.max(0, i - 5)];
    const far = points[Math.min(points.length - 1, i + 18)];
    const near = points[Math.max(0, i - 18)];
    const heading = Math.atan2(ahead.y - behind.y, ahead.x - behind.x);
    const wider = Math.atan2(far.y - near.y, far.x - near.x);
    const turn = Math.atan2(Math.sin(wider - heading), Math.cos(wider - heading));
    return { x: lerp(a.x, b.x, f), y: lerp(a.y, b.y, f), heading, turn };
  }

  /** Where the car is on the road at a moment, and which way it points (degrees, clockwise). */
  private carState(t: number): { x: number; y: number; angle: number } {
    const { startIndex, centerIndex, points } = this.road;
    const end = points.length - 2;
    let s: number;
    let slide: number;
    if (t < ENTER_S) {
      const p = ease.outCubic(t / ENTER_S);
      s = lerp(startIndex, centerIndex, p);
      slide = 30 * (1 - p) + 10;
    } else if (t < HOLD_END_S) {
      const k = t - ENTER_S;
      s = centerIndex + Math.sin(k * 5) * 1.2;
      slide = 10 + Math.sin(k * 6.5) * 5;
    } else {
      const u = (t - HOLD_END_S) / EXIT_S;
      s = Math.min(end, centerIndex + ((end - centerIndex) / 1.15) * (0.1 * u + u * u * u));
      slide = 10 + 22 * Math.sin(Math.PI * clamp01(u * 1.2));
    }
    const at = this.roadAt(s);
    // A drifting car points further into the bend than the way it is going.
    const turnSign = at.turn === 0 ? 1 : Math.sign(at.turn);
    return { x: at.x, y: at.y, angle: (at.heading * 180) / Math.PI + turnSign * slide };
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
      disc(layers.kerb.ctx, p.x, p.y, ROAD_HALF_WIDTH + KERB_WIDTH, Math.floor(i / 7) % 2 ? "#f4f0ff" : "#d6384a");
      disc(layers.asphalt.ctx, p.x, p.y, ROAD_HALF_WIDTH, i % 24 < 12 ? "#2d2c40" : "#2a2a3c");
      if (Math.floor(i / 9) % 2 === 0) rect(layers.detail.ctx, p.x, p.y, 2, 2, "#c9c6e6");
      if (rnd() < 0.5) {
        const angle = rnd() * Math.PI * 2;
        const radius = rnd() * (ROAD_HALF_WIDTH - 3);
        rect(layers.detail.ctx, p.x + Math.cos(angle) * radius, p.y + Math.sin(angle) * radius, 1, 1, rnd() < 0.5 ? "#3b3a52" : "#1f1e30");
      }
    }
    this.stamped = Math.max(this.stamped, untilIndex + 1);
  }

  /** Index of the road point nearest the car (searching forward from the last one found). */
  private roadIndexNear(x: number, y: number): number {
    const { points } = this.road;
    let best = this.lastIndex;
    let bestDistance = Infinity;
    for (let i = Math.max(0, this.lastIndex - 30); i < Math.min(points.length, this.lastIndex + 160); i++) {
      const d = (points[i].x - x) ** 2 + (points[i].y - y) ** 2;
      if (d < bestDistance) {
        bestDistance = d;
        best = i;
      }
    }
    this.lastIndex = best;
    return best;
  }

  private emitPuffs(dt: number, t: number, car: { x: number; y: number; angle: number }, speed: number) {
    const rate = t < ENTER_S ? 50 + 110 * (1 - t / ENTER_S) : t < HOLD_END_S ? 95 : 150;
    const count = Math.floor(rate * dt + this.rnd());
    const a = rad(car.angle);
    for (let i = 0; i < count; i++) {
      const side = this.rnd() < 0.5 ? -1 : 1;
      const lx = -10 * SPRITE_SCALE;
      const ly = side * 8 * SPRITE_SCALE;
      const r0 = 2 + Math.floor(this.rnd() * 2);
      this.puffs.push({
        x: car.x + Math.cos(a) * lx - Math.sin(a) * ly,
        y: car.y + Math.sin(a) * lx + Math.cos(a) * ly,
        vx: -Math.cos(a) * speed * 0.12 + (this.rnd() - 0.5) * 30,
        vy: -Math.sin(a) * speed * 0.12 + (this.rnd() - 0.5) * 30 - 6,
        age: 0,
        life: 0.9 + this.rnd() * 0.8,
        r0,
        r1: r0 + 5 + Math.floor(this.rnd() * 4),
      });
    }
    if (this.puffs.length > 360) this.puffs.splice(0, this.puffs.length - 360);
  }

  render(timeS: number) {
    const t = Math.max(timeS, 0);
    const dt = Math.min(Math.max(t - this.previous.t, 0), 0.05);
    const { ctx, layers } = this;
    if (!layers) return;
    const car = this.carState(t);
    const speed = dt > 0 ? Math.hypot(car.x - this.previous.x, car.y - this.previous.y) / dt : 0;
    this.wheelTurn += (speed * dt) / 5 + dt * 6;
    this.previous = { t, x: car.x, y: car.y };
    if (this.goneAt === null && t > HOLD_END_S && (car.x > this.width + 70 || car.x < -70 || car.y > HEIGHT + 70 || car.y < -70)) this.goneAt = t;

    // The road is laid just ahead of the car: it is not there until the car gets close.
    this.layRoad(this.roadIndexNear(car.x, car.y) + LOOK_AHEAD_PX);

    const launch = t > HOLD_END_S ? Math.max(0, 1 - (t - HOLD_END_S) / 0.3) : 0;
    const landing = t > ENTER_S && t < ENTER_S + 0.25 ? 1 - (t - ENTER_S) / 0.25 : 0;
    const shake = Math.max(launch, landing);
    ctx.setTransform(1, 0, 0, 1, Math.round((this.rnd() - 0.5) * 4 * shake), Math.round((this.rnd() - 0.5) * 3 * shake));
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(-4, -4, this.width + 8, HEIGHT + 8);
    ctx.drawImage(layers.kerb.canvas, 0, 0);
    ctx.drawImage(layers.asphalt.canvas, 0, 0);
    ctx.drawImage(layers.detail.canvas, 0, 0);

    // Tyre marks stay on the road behind the rear wheels.
    if (dt > 0 && this.goneAt === null) {
      const a = rad(car.angle);
      for (const side of [-1, 1]) {
        const lx = -10 * SPRITE_SCALE;
        const ly = side * 8 * SPRITE_SCALE;
        rect(layers.marks.ctx, car.x + Math.cos(a) * lx - Math.sin(a) * ly, car.y + Math.sin(a) * lx + Math.cos(a) * ly, 2, 2, "#12111c");
      }
    }
    ctx.drawImage(layers.marks.canvas, 0, 0);

    // Speed lines behind the car while it is moving fast.
    const fast = clamp01((speed - 160) / 300);
    if (fast > 0) {
      const heading = rad(car.angle);
      ctx.fillStyle = `rgba(233,230,255,${(0.2 + 0.35 * fast).toFixed(2)})`;
      for (let i = 0; i < 8; i++) {
        const lateral = (this.rnd() - 0.5) * 70;
        const back = 46 + this.rnd() * 60 * fast;
        const px = car.x - Math.cos(heading) * back - Math.sin(heading) * lateral;
        const py = car.y - Math.sin(heading) * back + Math.cos(heading) * lateral;
        ctx.fillRect(Math.round(px), Math.round(py), Math.round(10 + this.rnd() * 22 * fast), 1);
      }
    }

    if (dt > 0) this.emitPuffs(dt, t, car, speed);
    this.stepPuffs(dt);
    this.drawPuffs(true);

    // The car (each sprite pixel is 2 screen pixels), turned to the way it points; then the bean on top, always upright.
    drawCar(this.carCtx, this.wheelTurn);
    ctx.save();
    ctx.translate(Math.round(car.x), Math.round(car.y));
    ctx.rotate(rad(car.angle));
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.carSprite, (-SPRITE_W * SPRITE_SCALE) / 2, (-SPRITE_H * SPRITE_SCALE) / 2, SPRITE_W * SPRITE_SCALE, SPRITE_H * SPRITE_SCALE);
    ctx.restore();
    const glassesUp = clamp01((t - GLASSES_UP[0]) / 0.18) * (1 - clamp01((t - (GLASSES_UP[1] - 0.18)) / 0.18));
    this.beanCtx.clearRect(0, 0, 18, 18);
    drawBean(this.beanCtx, 9, 9, glassesUp, within(t, WINK));
    const seat = rad(car.angle);
    const beanX = car.x + Math.cos(seat) * -4 * SPRITE_SCALE;
    const beanY = car.y + Math.sin(seat) * -4 * SPRITE_SCALE;
    ctx.drawImage(this.beanSprite, Math.round(beanX - 9 * BEAN_SCALE), Math.round(beanY - 9 * BEAN_SCALE - 3), 18 * BEAN_SCALE, 18 * BEAN_SCALE);
    if (within(t, [WINK[0] + 0.05, WINK[1] + 0.2])) {
      drawSparkle(ctx, beanX + 20, beanY - 28, 4 + Math.round(Math.sin((t - WINK[0]) * 18)));
    }
    this.drawPuffs(false);

    // Pixel progress blocks and the closing fade to black once the car has gone.
    const blocks = 14;
    for (let i = 0; i < blocks; i++) {
      const done = this.goneAt !== null || i < Math.floor(Math.min(1, t / SCENE_SECONDS) * blocks + 0.5);
      rect(ctx, this.width / 2 - blocks * 5 + i * 10, HEIGHT - 20, 8, 5, done ? "#ffe08a" : "#2b2655");
    }
    const fade = this.goneAt === null ? 0 : clamp01((t - this.goneAt) / 0.4) * 0.85;
    if (fade > 0) {
      ctx.fillStyle = `rgba(5,4,15,${fade.toFixed(2)})`;
      ctx.fillRect(0, 0, this.width, HEIGHT);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  private stepPuffs(dt: number) {
    for (const puff of this.puffs) {
      puff.age += dt;
      puff.x += puff.vx * dt;
      puff.y += puff.vy * dt;
      puff.vx *= Math.exp(-dt * 1.6);
      puff.vy *= Math.exp(-dt * 1.6);
    }
    this.puffs = this.puffs.filter((puff) => puff.age < puff.life);
  }

  /** Smoke in three flat tones (bright, lavender, grey-violet), shrinking away at the end of its life. */
  private drawPuffs(behind: boolean) {
    for (const puff of this.puffs) {
      const isBehind = puff.age < puff.life * 0.55;
      if (isBehind !== behind) continue;
      const k = puff.age / puff.life;
      const radius = Math.max(1, Math.round(lerp(puff.r0, puff.r1, ease.outQuad(k)) * (k > 0.7 ? 1 - (k - 0.7) / 0.5 : 1)));
      disc(this.ctx, puff.x, puff.y, radius, k < 0.35 ? "#f6f2ff" : k < 0.65 ? "#d2caef" : "#9b91c4");
      if (k < 0.55 && radius > 3) disc(this.ctx, puff.x - 1, puff.y - 1, radius - 2, "#ffffff");
    }
  }
}
