// 瓦片图集：把"当前画面看得到的那一小片月面"的高清瓦片，按需下载并拼成一张画布贴图，盖在整张底图上。
// 放大时才有瓦片可下，缩回去就不再请求；没到的瓦片显示下面的底图，到了就换成清晰的，不会出现空白。
// 2D 地图和 3D 球共用，由不同的 TileSource 决定瓦片从哪来、第几级、什么时候开始用。
import * as THREE from "three";

/** 当前画面覆盖的范围，用贴图坐标（u 0..1 向东，v 0..1 向北）；worldWidthPx = 整张月面此刻在屏幕上有多宽（设备像素）。 */
export interface DetailView {
  west: number;
  east: number;
  south: number;
  north: number;
  worldWidthPx: number;
}

export interface TileSource {
  /** 加载中显示的提示；不写就不提示（无感加载）。 */
  statusLabel?: string;
  tilePx: number;
  /** 第 level 级整张图 2^(level+1) 列、2^level 行，第 0 行在北。 */
  urlFor: (level: number, row: number, col: number) => string;
  /** 整张图在屏幕上有多宽时，理想的瓦片级别；null = 现在不需要这一层。 */
  levelFor: (worldWidthPx: number) => number | null;
  /** 低于这一级就不用这一层（比如极区附近，瓦片比底图还粗）。 */
  minLevel: number;
  maxLevel: number;
  /** 0..1，这一层盖在底图上的不透明度。 */
  opacityFor: (worldWidthPx: number) => number;
  /** 一个方向上最多拼多少块（防止大屏幕上画布和请求数失控）。 */
  maxTilesPerAxis: number;
  /** 内存里最多留多少块已解码的瓦片，之后来回平移不用重新下。 */
  cacheTiles: number;
  fetchTimeoutMs: number;
}

const PARALLEL_DOWNLOADS = 4;
/** 画布上传到显卡最多这么久一次：瓦片一块块到达时合并上传，避免每块都整张重传。 */
const MIN_UPLOAD_INTERVAL_MS = 150;

/**
 * 着色器里取样瓦片图集的函数。返回的是预乘透明度的颜色：用法 `color = color * (1.0 - t.a) + t.rgb`。
 * 预乘之后，没下好的瓦片边缘做双线性插值也不会渗出一圈黑线。
 */
export function tileAtlasGlsl(name: string, functionName: string): string {
  return /* glsl */ `
uniform sampler2D u${name}Map;
uniform vec4 u${name}Bounds;
uniform float u${name}Opacity;
vec4 ${functionName}(vec2 uv) {
  float dx = uv.x - u${name}Bounds.x;
  dx -= floor(dx + 0.5);
  vec2 local = vec2(dx, uv.y - u${name}Bounds.y) / u${name}Bounds.zw;
  if (u${name}Opacity <= 0.0 || any(lessThan(local, vec2(0.0))) || any(greaterThan(local, vec2(1.0)))) return vec4(0.0);
  return texture2D(u${name}Map, local) * u${name}Opacity;
}`;
}

export interface TileAtlasUniforms {
  map: { value: THREE.Texture };
  bounds: { value: THREE.Vector4 };
  opacity: { value: number };
}

interface TileSlot {
  col: number;
  row: number;
  x: number;
  y: number;
}

export class TileAtlas {
  readonly uniforms: TileAtlasUniforms;
  private readonly canvas = document.createElement("canvas");
  private readonly ctx: CanvasRenderingContext2D;
  private readonly texture: THREE.CanvasTexture;
  private readonly cache = new Map<string, ImageBitmap>();
  private readonly status: HTMLParagraphElement | null;
  private controller: AbortController | null = null;
  private signature = "";
  private disposed = false;
  private uploadTimer = 0;
  private lastUploadMs = 0;

  /** colorData：true = 瓦片是给人看的颜色（3D 里走 sRGB），false = 按原值输出（2D 着色器自己不做转换）。invalidate：有新内容时让画面重画。 */
  constructor(private readonly source: TileSource, container: HTMLElement, colorData: boolean, private readonly invalidate: () => void) {
    this.canvas.width = this.canvas.height = 1;
    this.ctx = this.canvas.getContext("2d")!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = colorData ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    this.texture.generateMipmaps = false;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.premultiplyAlpha = true;
    this.uniforms = { map: { value: this.texture }, bounds: { value: new THREE.Vector4(0, 0, 1, 1) }, opacity: { value: 0 } };
    if (source.statusLabel) {
      this.status = document.createElement("p");
      this.status.className = "pointer-events-none absolute bottom-32 right-4 z-10 max-w-64 rounded-lg bg-black/65 px-3 py-2 text-xs text-white/70";
      this.status.setAttribute("role", "status");
      this.status.hidden = true;
      container.appendChild(this.status);
    } else {
      this.status = null;
    }
  }

  /** 每次画面范围变了调用。view 为 null（例如 3D 里离得太远）= 这一层不用。 */
  update(view: DetailView | null): void {
    const wanted = view ? this.source.levelFor(view.worldWidthPx) : null;
    const opacity = view ? this.source.opacityFor(view.worldWidthPx) : 0;
    if (!view || wanted === null || opacity <= 0) return this.deactivate();

    const spanU = Math.max(view.east - view.west, 0.00001);
    const spanV = Math.max(view.north - view.south, 0.00001);
    let level = Math.min(this.source.maxLevel, wanted);
    // 限制拼图的大小和请求数（包括两极附近和大屏幕）
    while (level > 0 && (spanU * 2 ** (level + 1) > this.source.maxTilesPerAxis || spanV * 2 ** level > this.source.maxTilesPerAxis)) level--;
    if (level < this.source.minLevel) return this.deactivate(); // 宁可显示底图，也不用比底图更粗的瓦片盖上去
    this.uniforms.opacity.value = opacity;

    const cols = 2 ** (level + 1);
    const rows = 2 ** level;
    const left = Math.floor(view.west * cols) - 1;
    const right = Math.ceil(view.east * cols);
    const top = Math.max(0, Math.floor((1 - view.north) * rows) - 1);
    const bottom = Math.min(rows - 1, Math.ceil((1 - view.south) * rows));
    const signature = `${level}/${left}/${right}/${top}/${bottom}`;
    if (signature === this.signature) return;
    this.rebuild(signature, level, cols, rows, { left, right, top, bottom });
  }

  dispose(): void {
    this.disposed = true;
    this.controller?.abort();
    window.clearTimeout(this.uploadTimer);
    this.status?.remove();
    this.cache.forEach((bitmap) => bitmap.close());
    this.cache.clear();
    this.texture.dispose();
  }

  private deactivate(): void {
    this.uniforms.opacity.value = 0;
    this.controller?.abort();
    this.controller = null;
    this.signature = "";
    if (this.status) this.status.hidden = true;
  }

  private rebuild(signature: string, level: number, cols: number, rows: number, range: { left: number; right: number; top: number; bottom: number }): void {
    const { tilePx } = this.source;
    const { left, right, top, bottom } = range;
    this.signature = signature;
    this.controller?.abort();
    const controller = new AbortController();
    this.controller = controller;

    // 重新分配画布（尺寸一变内容就清空），已经下载过的瓦片马上从内存里画回去
    this.texture.dispose();
    this.canvas.width = (right - left + 1) * tilePx;
    this.canvas.height = (bottom - top + 1) * tilePx;
    this.uniforms.bounds.value.set(left / cols, 1 - (bottom + 1) / rows, (right - left + 1) / cols, (bottom - top + 1) / rows);
    this.scheduleUpload(true);

    const missing: TileSlot[] = [];
    for (let row = top; row <= bottom; row++) {
      for (let col = left; col <= right; col++) {
        const slot = { col: ((col % cols) + cols) % cols, row, x: (col - left) * tilePx, y: (row - top) * tilePx };
        const key = `${level}/${row}/${slot.col}`;
        const cached = this.cache.get(key);
        if (cached) {
          this.cache.delete(key); // 刷新"最近使用"
          this.cache.set(key, cached);
          this.drawTile(cached, slot);
        } else {
          missing.push(slot);
        }
      }
    }
    this.setStatus(missing.length > 0);

    let failed = false;
    const worker = async () => {
      while (missing.length > 0 && !controller.signal.aborted) {
        const slot = missing.shift()!;
        try {
          const bitmap = await this.downloadTile(level, slot, controller.signal);
          if (controller.signal.aborted || this.disposed) {
            bitmap.close();
            continue;
          }
          this.remember(`${level}/${slot.row}/${slot.col}`, bitmap);
          this.drawTile(bitmap, slot);
        } catch {
          if (!controller.signal.aborted) failed = true;
        }
      }
    };
    void Promise.all(Array.from({ length: Math.min(PARALLEL_DOWNLOADS, missing.length) }, worker)).then(() => {
      if (controller.signal.aborted || this.disposed) return;
      this.setStatus(false, failed);
    });
  }

  private async downloadTile(level: number, slot: TileSlot, signal: AbortSignal): Promise<ImageBitmap> {
    const response = await fetch(this.source.urlFor(level, slot.row, slot.col), { signal: AbortSignal.any([signal, AbortSignal.timeout(this.source.fetchTimeoutMs)]), credentials: "omit" });
    if (!response.ok) throw new Error("Imagery unavailable");
    return createImageBitmap(await response.blob());
  }

  private remember(key: string, bitmap: ImageBitmap): void {
    this.cache.set(key, bitmap);
    while (this.cache.size > this.source.cacheTiles) {
      const oldest = this.cache.keys().next().value!;
      this.cache.get(oldest)!.close();
      this.cache.delete(oldest);
    }
  }

  private drawTile(bitmap: ImageBitmap, slot: TileSlot): void {
    this.ctx.drawImage(bitmap, slot.x, slot.y, this.source.tilePx, this.source.tilePx);
    this.scheduleUpload(false);
  }

  /** 瓦片一块块到：合并成最多每 150 ms 上传一次整张画布。force 用于刚重新分配画布时马上上传。 */
  private scheduleUpload(force: boolean): void {
    if (force) {
      window.clearTimeout(this.uploadTimer);
      this.uploadTimer = 0;
      this.upload();
      return;
    }
    if (this.uploadTimer) return;
    const wait = Math.max(0, this.lastUploadMs + MIN_UPLOAD_INTERVAL_MS - performance.now());
    this.uploadTimer = window.setTimeout(() => {
      this.uploadTimer = 0;
      this.upload();
    }, wait);
  }

  private upload(): void {
    if (this.disposed) return;
    this.lastUploadMs = performance.now();
    this.texture.needsUpdate = true;
    this.invalidate();
  }

  private setStatus(loading: boolean, failed = false): void {
    if (!this.status || !this.source.statusLabel) return;
    this.status.textContent = failed ? "Detailed imagery unavailable; showing the global map." : this.source.statusLabel;
    this.status.hidden = !(loading || failed);
  }
}
