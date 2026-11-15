// Drawing thousands of coloured characters every frame with fillText is slow. This keeps a small
// picture sheet (an "atlas") of every character-and-colour pair that has been needed so far, and
// each frame just copies the right square from the sheet. Colours are rounded to 4 bits per channel,
// which is invisible in characters this small.

const ATLAS_SIZE = 2048;

export class GlyphAtlas {
  readonly slotW: number;
  readonly slotH: number;
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly slots = new Map<number, number>();
  private readonly perRow: number;
  private readonly capacity: number;
  private next = 0;

  /** `cellW` and `cellH` are in CSS pixels; `scale` is the device pixel ratio. */
  constructor(private readonly characters: string, cellW: number, cellH: number, private readonly fontPx: number, private readonly scale: number) {
    this.slotW = Math.ceil(cellW * scale) + 2;
    this.slotH = Math.ceil(cellH * scale) + 2;
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.canvas.height = ATLAS_SIZE;
    const context = this.canvas.getContext("2d");
    if (!context) throw new Error("2D canvas is not available");
    this.context = context;
    this.perRow = Math.floor(ATLAS_SIZE / this.slotW);
    this.capacity = this.perRow * Math.floor(ATLAS_SIZE / this.slotH);
    this.prepare();
  }

  private prepare() {
    this.context.font = `${this.fontPx * this.scale}px ui-monospace, "Cascadia Mono", Menlo, Consolas, monospace`;
    this.context.textAlign = "center";
    this.context.textBaseline = "middle";
  }

  private slotFor(level: number, r: number, g: number, b: number): number {
    const key = level * 4096 + ((r >> 4) << 8) + ((g >> 4) << 4) + (b >> 4);
    const known = this.slots.get(key);
    if (known !== undefined) return known;
    if (this.next >= this.capacity) {
      // Full: start the sheet again; whatever is still on screen is redrawn into it within a frame.
      this.context.clearRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);
      this.slots.clear();
      this.next = 0;
      this.prepare();
    }
    const slot = this.next++;
    this.slots.set(key, slot);
    const x = (slot % this.perRow) * this.slotW;
    const y = Math.floor(slot / this.perRow) * this.slotH;
    this.context.fillStyle = `rgb(${(r >> 4) * 17},${(g >> 4) * 17},${(b >> 4) * 17})`;
    this.context.fillText(this.characters[level], x + this.slotW / 2, y + this.slotH * 0.54);
    return slot;
  }

  /** Draws character number `level` in the given colour, centred on (x, y) in CSS pixels. */
  draw(target: CanvasRenderingContext2D, level: number, r: number, g: number, b: number, x: number, y: number) {
    const slot = this.slotFor(level, r, g, b);
    const sx = (slot % this.perRow) * this.slotW;
    const sy = Math.floor(slot / this.perRow) * this.slotH;
    const width = this.slotW / this.scale;
    const height = this.slotH / this.scale;
    // Snap to whole device pixels so the characters stay crisp.
    const dx = Math.round((x - width / 2) * this.scale) / this.scale;
    const dy = Math.round((y - height / 2) * this.scale) / this.scale;
    target.drawImage(this.canvas, sx, sy, this.slotW, this.slotH, dx, dy, width, height);
  }
}
