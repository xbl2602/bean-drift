// The "loading" animation between the landing page and the product page: a pixel-art scene in the
// style of old arcade racing games. The bean drives in sideways from the left along a night track,
// throwing up tyre smoke, stops dead centre so you can see it (it flips its sunglasses up and winks),
// then swings round and speeds off to the right.
//
// Everything is drawn with filled rectangles on a very small canvas (180 pixels tall) that the browser
// scales up without smoothing, so every "pixel" is a crisp square. No pictures are used: the car, the
// bean, the track and the smoke are all made in code (see docs/CREDITS.md).

/** Roughly how long the whole show lasts (the car is gone a little after this); only used for the progress bar. */
export const SCENE_SECONDS = 3.7;
/** The page is changed only once the car has completely left the picture; this is the longest we ever wait. */
export const GIVE_UP_AT_S = 6;

const HEIGHT = 180;
const ROAD_TOP = 104;
const SPRITE_W = 64;
const SPRITE_H = 32;
const SPRITE_SCALE = 3;
const CAR_Y = 126;
/** Where the rear wheel sits, in screen pixels from the middle of the car. */
const REAR_WHEEL = { x: -18 * SPRITE_SCALE, y: 7 * SPRITE_SCALE };

const ENTER_S = 1.2;
const HOLD_END_S = 2.25;
const EXIT_S = 1.5;
/** The car turns this far (degrees, clockwise) while it speeds away, so it leaves in a curve, not a straight line. */
const EXIT_TURN_DEG = 40;
const GLASSES_UP = [1.3, 2.05] as const;
const WINK = [1.55, 1.9] as const;

const ease = {
  inOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  outCubic: (t: number) => 1 - (1 - t) ** 3,
  inCubic: (t: number) => t * t * t,
  inQuad: (t: number) => t * t,
  outQuad: (t: number) => 1 - (1 - t) * (1 - t),
};
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const within = (t: number, [from, to]: readonly [number, number]) => t >= from && t <= to;
const rad = (deg: number) => (deg * Math.PI) / 180;

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

// ---------- the track and sky, drawn once per size ----------

function drawBackdrop(ctx: CanvasRenderingContext2D, width: number) {
  const rnd = seeded(7);
  // Sky in visible bands, like an old palette-swapped gradient.
  const bands = ["#080620", "#0c0a2a", "#120f38", "#1a1548", "#251d5a", "#33286d", "#463784"];
  const bandHeight = Math.ceil(ROAD_TOP / bands.length);
  bands.forEach((color, i) => rect(ctx, 0, i * bandHeight, width, bandHeight + 1, color));
  for (let i = 0; i < width / 3; i++) {
    const y = Math.floor(rnd() * ROAD_TOP * 0.8);
    rect(ctx, Math.floor(rnd() * width), y, 1, 1, rnd() > 0.7 ? "#ffe9a8" : "#e9e6ff");
  }
  // A crescent Moon and a small Earth: this is the Lunar Quest night.
  disc(ctx, width * 0.14, 30, 13, "#f3efcf");
  disc(ctx, width * 0.14 + 6, 27, 11, "#120f38");
  disc(ctx, width * 0.86, 24, 7, "#3f86e8");
  rect(ctx, width * 0.86 - 4, 22, 5, 3, "#4fb26a");
  rect(ctx, width * 0.86 + 1, 27, 4, 2, "#e9f2ff");
  // Two layers of hills and a row of pine trees.
  for (const [base, amp, color, seed] of [[ROAD_TOP - 28, 12, "#17133f", 1], [ROAD_TOP - 16, 9, "#100d2f", 2]] as const) {
    for (let x = 0; x < width; x++) {
      const h = base + Math.sin(x * 0.03 + seed) * amp + Math.sin(x * 0.011 + seed * 3) * amp * 0.8;
      rect(ctx, x, h, 1, ROAD_TOP - h, color);
    }
  }
  for (let x = 4; x < width; x += 9 + Math.floor(rnd() * 10)) {
    const top = ROAD_TOP - 24 - Math.floor(rnd() * 8);
    for (let row = 0; row < 4; row++) rect(ctx, x - 2 - row, top + row * 5, 5 + row * 2, 5, "#0a0924");
    rect(ctx, x, top + 20, 1, ROAD_TOP - top - 20, "#0a0924");
  }
  // Guard rail with yellow chevron signs.
  rect(ctx, 0, ROAD_TOP - 7, width, 3, "#8a8fb0");
  rect(ctx, 0, ROAD_TOP - 4, width, 1, "#4d5070");
  for (let x = 0; x < width; x += 16) rect(ctx, x, ROAD_TOP - 7, 2, 7, "#5b5e80");
  for (let x = 26; x < width; x += 84) {
    rect(ctx, x, ROAD_TOP - 24, 22, 16, "#0d0c1c");
    rect(ctx, x + 1, ROAD_TOP - 23, 20, 14, "#f2b632");
    for (const dx of [4, 11]) for (let k = 0; k < 5; k++) {
      rect(ctx, x + dx + (k < 3 ? k : 4 - k), ROAD_TOP - 21 + k * 2, 3, 2, "#1a1426");
    }
    rect(ctx, x + 10, ROAD_TOP - 8, 2, 4, "#5b5e80");
  }
  // The road: asphalt, red and white kerb, dashed centre line.
  for (let y = ROAD_TOP; y < HEIGHT; y++) {
    const shade = Math.floor(((y - ROAD_TOP) / (HEIGHT - ROAD_TOP)) * 3);
    rect(ctx, 0, y, width, 1, ["#2d2c40", "#272638", "#212031"][shade]);
  }
  for (let x = 0; x < width; x += 8) rect(ctx, x, ROAD_TOP, 8, 3, (x / 8) % 2 ? "#f4f0ff" : "#d6384a");
  for (let i = 0; i < width * 4; i++) rect(ctx, rnd() * width, ROAD_TOP + 4 + rnd() * (HEIGHT - ROAD_TOP - 4), 1, 1, rnd() > 0.5 ? "#36354b" : "#1c1b2b");
  for (let x = 6; x < width; x += 24) rect(ctx, x, 158, 12, 2, "#c9c6e6");
}

// ---------- the car and the bean ----------

function drawBean(ctx: CanvasRenderingContext2D, x: number, y: number, glassesUp: number, wink: boolean) {
  disc(ctx, x, y, 7, "#46600f"); // outline
  disc(ctx, x, y, 6, "#a8c43a");
  disc(ctx, x + 2, y + 2, 4, "#8ba82c"); // shaded lower side
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

function drawSprite(ctx: CanvasRenderingContext2D, timeS: number, wheelTurn: number) {
  ctx.clearRect(0, 0, SPRITE_W, SPRITE_H);
  const glassesUp = clamp01((timeS - GLASSES_UP[0]) / 0.18) * (1 - clamp01((timeS - (GLASSES_UP[1] - 0.18)) / 0.18));
  const wink = within(timeS, WINK);
  // Rear spoiler.
  rect(ctx, 1, 5, 11, 2, "#14131f");
  rect(ctx, 3, 7, 2, 5, "#14131f");
  // Cabin: a low sloping hatchback roof with the glass inset, so the bean shows through the windscreen.
  for (let y = 2; y <= 12; y++) {
    const left = Math.round(15 + (12 - y) * 0.5);
    const right = Math.round(47 - (12 - y) * 1.3);
    rect(ctx, left, y, right - left, 1, "#e9e6f6");
    if (y >= 4) rect(ctx, left + 3, y, right - left - 6, 1, "#3a2f78");
  }
  rect(ctx, 20, 5, 5, 1, "#8b7fe0");
  rect(ctx, 22, 6, 3, 1, "#6a5ec4");
  drawBean(ctx, 31, 10, glassesUp, wink);
  // Body: white upper half, black lower half and bumpers, like the classic two-tone hatchback.
  rect(ctx, 3, 13, 58, 5, "#f1eef9");
  rect(ctx, 3, 18, 58, 5, "#1b1a27");
  rect(ctx, 2, 14, 2, 8, "#2a2938");
  rect(ctx, 60, 14, 2, 8, "#2a2938");
  rect(ctx, 6, 16, 52, 1, "#c3bfd8");
  rect(ctx, 5, 18, 54, 1, "#2f2e42");
  // Lights.
  rect(ctx, 57, 14, 5, 3, "#ffd96b");
  rect(ctx, 58, 14, 3, 1, "#fff6c8");
  rect(ctx, 57, 19, 4, 2, "#f2a33a");
  rect(ctx, 2, 14, 3, 3, "#d6384a");
  // Wheels, with spokes that turn.
  for (const wx of [14, 49]) {
    disc(ctx, wx, 23, 6, "#0c0b14");
    disc(ctx, wx, 23, 3, "#8a8fb0");
    disc(ctx, wx, 23, 1, "#2d2c40");
    const a = wheelTurn;
    for (let k = 0; k < 3; k++) {
      const angle = a + (k * Math.PI * 2) / 3;
      rect(ctx, wx + Math.cos(angle) * 2.4, 23 + Math.sin(angle) * 2.4, 1, 1, "#e9e6f6");
    }
  }
}

function drawSparkle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  rect(ctx, x - size, y, size * 2 + 1, 1, "#fff2a8");
  rect(ctx, x, y - size, 1, size * 2 + 1, "#fff2a8");
  rect(ctx, x - 1, y - 1, 3, 3, "#ffffff");
}

export class DriftScene {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly sprite = document.createElement("canvas");
  private readonly spriteCtx: CanvasRenderingContext2D;
  private readonly backdrop = document.createElement("canvas");
  private width = 320;
  private puffs: Puff[] = [];
  private marks: { x: number; y: number }[] = [];
  private previous = { t: 0, x: 0, y: 0 };
  private wheelTurn = 0;
  private rnd = seeded(99);
  private goneAt: number | null = null;

  /** Whether the car has completely left the picture (the page can change now). */
  get carHasLeft(): boolean {
    return this.goneAt !== null;
  }

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    const spriteCtx = this.sprite.getContext("2d");
    if (!ctx || !spriteCtx) throw new Error("2D canvas is not available");
    this.ctx = ctx;
    this.spriteCtx = spriteCtx;
    this.sprite.width = SPRITE_W;
    this.sprite.height = SPRITE_H;
    this.resize(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight);
  }

  /** The picture is always 180 pixels tall; its width follows the screen shape. */
  resize(cssWidth: number, cssHeight: number) {
    this.width = Math.min(560, Math.max(260, Math.round((HEIGHT * cssWidth) / Math.max(cssHeight, 1))));
    this.canvas.width = this.width;
    this.canvas.height = HEIGHT;
    this.backdrop.width = this.width;
    this.backdrop.height = HEIGHT;
    const context = this.backdrop.getContext("2d");
    if (context) drawBackdrop(context, this.width);
    this.ctx.imageSmoothingEnabled = false;
  }

  /** Where the car is at a moment: position of its middle, and how far it is turned (degrees, clockwise). */
  private carState(t: number): { x: number; y: number; angle: number } {
    const w = this.width;
    if (t < ENTER_S) {
      const p = ease.outCubic(t / ENTER_S);
      return { x: lerp(-100, w / 2, p), y: lerp(CAR_Y + 12, CAR_Y, p), angle: lerp(-26, -7, p) };
    }
    if (t < HOLD_END_S) {
      const k = t - ENTER_S;
      return { x: w / 2 + Math.sin(k * 5) * 1.5, y: CAR_Y + Math.sin(k * 11) * 1.2, angle: -7 + Math.sin(k * 8) * 1.4 };
    }
    // Leaving: the car speeds up and swings round to the right in one long curve, drifting (its nose
    // points further round than the way it is travelling), and keeps going until it is completely off screen.
    const q = (t - HOLD_END_S) / EXIT_S; // 0 to 1 over the main turn; keeps growing after that
    const reach = (w / 2 + 230) / 0.9;
    const steps = 40;
    let dx = 0;
    let dy = 0;
    for (let i = 0; i < steps; i++) {
      const u = ((i + 0.5) / steps) * q;
      const heading = rad(EXIT_TURN_DEG * ease.inOutQuad(clamp01(u)));
      const speed = 0.15 + 3 * u * u;
      dx += Math.cos(heading) * speed * (q / steps) * reach;
      dy += Math.sin(heading) * speed * (q / steps) * reach;
    }
    const heading = EXIT_TURN_DEG * ease.inOutQuad(clamp01(q));
    const slip = 16 * Math.sin(Math.PI * clamp01(q * 1.5));
    return { x: w / 2 + dx, y: CAR_Y + dy, angle: -7 + heading + slip };
  }

  /** True once the car is completely outside the picture. */
  isCarGone(timeS: number): boolean {
    if (timeS <= HOLD_END_S) return false;
    const car = this.carState(timeS);
    return car.x > this.width + SPRITE_W * SPRITE_SCALE * 0.6 || car.y > HEIGHT + SPRITE_H * SPRITE_SCALE;
  }

  private emitPuffs(dt: number, t: number, x: number, y: number, angle: number, speed: number) {
    const rate = t < ENTER_S ? 40 + 110 * (1 - t / ENTER_S) : t < HOLD_END_S ? 16 : 130;
    const count = Math.floor(rate * dt + this.rnd());
    const rearX = x + Math.cos(rad(angle)) * REAR_WHEEL.x - Math.sin(rad(angle)) * REAR_WHEEL.y;
    const rearY = y + Math.sin(rad(angle)) * REAR_WHEEL.x + Math.cos(rad(angle)) * REAR_WHEEL.y;
    for (let i = 0; i < count; i++) {
      const r0 = 2 + Math.floor(this.rnd() * 2);
      this.puffs.push({
        x: rearX + (this.rnd() - 0.5) * 4,
        y: rearY + (this.rnd() - 0.5) * 3,
        vx: -speed * 0.28 + (this.rnd() - 0.5) * 26,
        vy: -(8 + this.rnd() * 26),
        age: 0,
        life: 0.9 + this.rnd() * 0.8,
        r0,
        r1: r0 + 5 + Math.floor(this.rnd() * 4),
      });
    }
    if (this.puffs.length > 320) this.puffs.splice(0, this.puffs.length - 320);
  }

  render(timeS: number) {
    const t = Math.max(timeS, 0);
    if (this.goneAt === null && this.isCarGone(t)) this.goneAt = t;
    const dt = Math.min(Math.max(t - this.previous.t, 0), 0.05);
    const { ctx } = this;
    const car = this.carState(t);
    const speed = dt > 0 ? (car.x - this.previous.x) / dt : 0;
    this.wheelTurn += (Math.abs(speed) * dt) / 6 + dt * 6;
    this.previous = { t, x: car.x, y: car.y };

    // Little camera shake as the car lands and as it launches away.
    const launch = t > HOLD_END_S ? Math.max(0, 1 - (t - HOLD_END_S) / 0.35) : 0;
    const landing = t < ENTER_S + 0.3 && t > ENTER_S ? 1 - (t - ENTER_S) / 0.3 : 0;
    const shake = Math.max(launch, landing);
    ctx.setTransform(1, 0, 0, 1, Math.round((this.rnd() - 0.5) * 4 * shake), Math.round((this.rnd() - 0.5) * 3 * shake));
    ctx.drawImage(this.backdrop, 0, 0);

    // Tyre marks stay on the road behind the rear wheels.
    if (dt > 0 && (t < ENTER_S || (t > HOLD_END_S - 0.1 && !this.carHasLeft))) {
      this.marks.push({ x: car.x + Math.cos(rad(car.angle)) * REAR_WHEEL.x - Math.sin(rad(car.angle)) * (REAR_WHEEL.y + 8), y: car.y + Math.sin(rad(car.angle)) * REAR_WHEEL.x + Math.cos(rad(car.angle)) * (REAR_WHEEL.y + 8) });
    }
    ctx.fillStyle = "#12111c";
    for (const mark of this.marks) ctx.fillRect(Math.round(mark.x), Math.min(HEIGHT - 2, Math.max(ROAD_TOP + 4, Math.round(mark.y))), 3, 2);

    // Speed lines behind the car while it is moving fast.
    const fast = clamp01((Math.abs(speed) - 140) / 260);
    if (fast > 0) {
      ctx.fillStyle = `rgba(233,230,255,${(0.2 + 0.4 * fast).toFixed(2)})`;
      for (let i = 0; i < 9; i++) {
        const y = ROAD_TOP - 40 + this.rnd() * 110;
        const length = 14 + this.rnd() * 36 * fast;
        const x = car.x - 80 - this.rnd() * 90 * fast;
        ctx.fillRect(Math.round(x), Math.round(y), Math.round(length), 1);
      }
    }

    if (dt > 0) this.emitPuffs(dt, t, car.x, car.y, car.angle, speed);
    this.stepPuffs(dt);
    this.drawPuffs(true);

    // The car itself: drawn big (each sprite pixel is 2 screen pixels) and turned about its middle.
    drawSprite(this.spriteCtx, t, this.wheelTurn);
    ctx.save();
    ctx.translate(Math.round(car.x), Math.round(car.y));
    ctx.rotate(rad(car.angle));
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.sprite, (-SPRITE_W * SPRITE_SCALE) / 2, (-SPRITE_H * SPRITE_SCALE) / 2, SPRITE_W * SPRITE_SCALE, SPRITE_H * SPRITE_SCALE);
    ctx.restore();
    if (within(t, [WINK[0] + 0.05, WINK[1] + 0.2])) {
      drawSparkle(ctx, car.x + 14, car.y - 52, 4 + Math.round(Math.sin((t - WINK[0]) * 18)));
    }
    this.drawPuffs(false); // smoke in front of the wheels, drawn over the car

    // Pixel progress blocks and the closing fade to black.
    const blocks = 14;
    for (let i = 0; i < blocks; i++) {
      const done = i < Math.floor(Math.min(1, t / SCENE_SECONDS) * blocks + 0.5);
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
      puff.vx *= Math.exp(-dt * 1.4);
      puff.vy *= Math.exp(-dt * 1.1);
    }
    this.puffs = this.puffs.filter((puff) => puff.age < puff.life);
  }

  /** Smoke in three flat tones (bright, lavender, grey-violet), shrinking away at the end of its life. */
  private drawPuffs(behind: boolean) {
    for (const puff of this.puffs) {
      const isBehind = puff.vx <= 0 || puff.age < puff.life * 0.5;
      if (isBehind !== behind) continue;
      const k = puff.age / puff.life;
      const radius = Math.max(1, Math.round(lerp(puff.r0, puff.r1, ease.outQuad(k)) * (k > 0.7 ? 1 - (k - 0.7) / 0.5 : 1)));
      disc(this.ctx, puff.x, puff.y, radius, k < 0.35 ? "#f6f2ff" : k < 0.65 ? "#d2caef" : "#9b91c4");
      if (k < 0.55 && radius > 3) disc(this.ctx, puff.x - 1, puff.y - 1, radius - 2, "#ffffff");
    }
  }
}
