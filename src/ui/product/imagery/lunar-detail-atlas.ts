// Public NASA Moon Trek WMTS imagery. Display-only; never used for terrain/analysis.
import * as THREE from "three";
export interface DetailView { west: number; east: number; south: number; north: number; worldWidthPx: number }
const TILE_PX = 256;
const MAX_LEVEL = 8;
const BASE = "https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm";
export const DETAIL_GLSL = /* glsl */ `
uniform sampler2D uDetailMap;
uniform vec4 uDetailBounds;
uniform float uDetailOpacity;
vec4 lunarDetail(vec2 uv) {
  float dx = uv.x - uDetailBounds.x;
  dx -= floor(dx + 0.5);
  vec2 local = vec2(dx, uv.y - uDetailBounds.y) / uDetailBounds.zw;
  if (uDetailOpacity <= 0.0 || any(lessThan(local, vec2(0.0))) || any(greaterThan(local, vec2(1.0)))) return vec4(0.0);
  vec4 detail = texture2D(uDetailMap, local);
  detail.a *= uDetailOpacity;
  return detail;
}`;

export class LunarDetailAtlas {
  readonly uniforms: { uDetailMap: { value: THREE.Texture }; uDetailBounds: { value: THREE.Vector4 }; uDetailOpacity: { value: number } };
  private canvas = document.createElement("canvas");
  private ctx: CanvasRenderingContext2D;
  private cache = new Map<string, ImageBitmap>();
  private controller: AbortController | null = null;
  private signature = "";
  private disposed = false;
  private status = document.createElement("p");
  constructor(container: HTMLElement, colorData: boolean, private invalidate: () => void) {
    this.canvas.width = this.canvas.height = 1;
    this.ctx = this.canvas.getContext("2d")!;
    const texture = new THREE.CanvasTexture(this.canvas);
    texture.colorSpace = colorData ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    this.uniforms = { uDetailMap: { value: texture }, uDetailBounds: { value: new THREE.Vector4(0, 0, 1, 1) }, uDetailOpacity: { value: 0 } };
    this.status.className = "pointer-events-none absolute bottom-32 right-4 z-10 max-w-64 rounded-lg bg-black/65 px-3 py-2 text-xs text-white/70";
    this.status.setAttribute("role", "status");
    this.status.hidden = true;
    container.appendChild(this.status);
  }
  update(view: DetailView | null) {
    const opacity = view ? THREE.MathUtils.clamp((view.worldWidthPx - 18000) / 12000, 0, 1) : 0;
    this.uniforms.uDetailOpacity.value = opacity;
    if (!view || opacity === 0) {
      this.controller?.abort(); this.controller = null; this.signature = ""; this.status.hidden = true;
      return;
    }
    const spanU = Math.max(view.east - view.west, 0.00001);
    const spanV = Math.max(view.north - view.south, 0.00001);
    let level = Math.min(MAX_LEVEL, Math.max(5, Math.ceil(Math.log2(view.worldWidthPx / 512))));
    // Bound the atlas and request count, including at the poles or on large displays.
    while (level > 0 && (spanU * 2 ** (level + 1) > 12 || spanV * 2 ** level > 12)) level--;
    if (level < 6) {
      this.uniforms.uDetailOpacity.value = 0;
      this.controller?.abort(); this.controller = null; this.signature = ""; this.status.hidden = true;
      return; // Never replace the 16K base with a coarser tile level near a pole.
    }
    const cols = 2 ** (level + 1), rows = 2 ** level;
    const left = Math.floor(view.west * cols) - 1, right = Math.ceil(view.east * cols);
    const top = Math.max(0, Math.floor((1 - view.north) * rows) - 1);
    const bottom = Math.min(rows - 1, Math.ceil((1 - view.south) * rows));
    const signature = `${level}/${left}/${right}/${top}/${bottom}`;
    if (signature === this.signature) return;
    this.signature = signature;
    this.controller?.abort();
    const controller = new AbortController(); this.controller = controller;
    this.uniforms.uDetailMap.value.dispose();
    this.canvas.width = (right - left + 1) * TILE_PX;
    this.canvas.height = (bottom - top + 1) * TILE_PX;
    this.uniforms.uDetailBounds.value.set(left / cols, 1 - (bottom + 1) / rows, (right - left + 1) / cols, (bottom - top + 1) / rows);
    this.uniforms.uDetailMap.value.needsUpdate = true;
    const queue: Array<{ col: number; row: number; x: number; y: number }> = [];
    let failed = false;
    for (let row = top; row <= bottom; row++) for (let col = left; col <= right; col++) {
      queue.push({ col: ((col % cols) + cols) % cols, row, x: (col - left) * TILE_PX, y: (row - top) * TILE_PX });
    }
    const draw = (bitmap: ImageBitmap, x: number, y: number) => {
      this.ctx.drawImage(bitmap, x, y, TILE_PX, TILE_PX);
      this.uniforms.uDetailMap.value.needsUpdate = true;
      this.invalidate();
    };
    const missing = queue.filter((tile) => {
      const key = `${level}/${tile.row}/${tile.col}`, cached = this.cache.get(key);
      if (!cached) return true;
      this.cache.delete(key); this.cache.set(key, cached);
      draw(cached, tile.x, tile.y); return false;
    });
    this.status.textContent = "Loading sharper lunar imagery…";
    this.status.hidden = missing.length === 0;
    const worker = async () => {
      while (missing.length && !controller.signal.aborted) {
        const tile = missing.shift()!;
        const key = `${level}/${tile.row}/${tile.col}`;
        try {
          const response = await fetch(`${BASE}/${key}.jpg`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]), credentials: "omit" });
          if (!response.ok) throw new Error("Imagery unavailable");
          const bitmap = await createImageBitmap(await response.blob());
          if (controller.signal.aborted || this.disposed) { bitmap.close(); continue; }
          this.cache.set(key, bitmap);
          draw(bitmap, tile.x, tile.y);
          while (this.cache.size > 128) {
            const oldest = this.cache.keys().next().value!;
            this.cache.get(oldest)!.close(); this.cache.delete(oldest);
          }
        } catch {
          if (!controller.signal.aborted) failed = true;
        }
      }
    };
    void Promise.all(Array.from({ length: Math.min(4, missing.length) }, worker)).then(() => {
      if (controller.signal.aborted || this.disposed) return;
      this.status.textContent = failed ? "Detailed imagery unavailable; showing the global map." : "";
      this.status.hidden = !failed;
    });
  }
  dispose() {
    this.disposed = true; this.controller?.abort(); this.status.remove();
    this.cache.forEach((bitmap) => bitmap.close()); this.cache.clear();
    this.uniforms.uDetailMap.value.dispose();
  }
}
