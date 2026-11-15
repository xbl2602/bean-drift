// 瓦片图集：把"当前画面看得到的那一小片月面"的高清瓦片，按需下载，写进显存里一张常驻的大贴图（见 tile-slot-store.ts），盖在整张底图上。
// 放大时才有瓦片可下，缩回去就不再请求；没到的瓦片显示下面的底图，到了就换成清晰的，不会出现空白。
// 2D 地图和 3D 球共用，由不同的 TileSource 决定瓦片从哪来、第几级、什么时候开始用。
//
// 为什么不是拼一张画布：画布每次范围变动都要整张重新分配、重传显卡（几十到上百毫秒），放大缩小时会卡。
// 现在显存里的贴图常驻，瓦片到了只写它自己的格子，平移只补新进来的格子；写入还按每帧时间预算分摊。
import * as THREE from "three";
import { TileSlotStore } from "./tile-slot-store";

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
  /** 显存里常驻的格子数（横、纵）。视野加一圈余量放不进格子，就降一级。 */
  slotsX: number;
  slotsY: number;
  /** 一个方向上最多拼多少块（防止大屏幕上请求数失控），实际不会超过格子数。 */
  maxTilesPerAxis: number;
  /** 内存里最多留多少块已解码的瓦片：被别的瓦片顶掉格子之后再看回来，不用重新下载解码。 */
  cacheTiles: number;
  fetchTimeoutMs: number;
}

const PARALLEL_DOWNLOADS = 4;
/** 每帧最多花这么多毫秒往显存写瓦片；写不完的下一帧接着写，避免一次涌入造成卡顿。 */
const UPLOAD_BUDGET_MS = 4;

/**
 * 着色器里取样瓦片图集的函数。返回的是预乘透明度的颜色：用法 `color = color * (1.0 - t.a) + t.rgb`。
 * 预乘之后，没下好的瓦片边缘做双线性插值也不会渗出一圈黑线。
 * Bounds = 当前窗口（west, south, 宽, 高，贴图坐标）；Layout = 整张图的列数、行数，和显存里的格子数（横、纵）。
 * 瓦片 (col, row) 在显存里固定放在格子 (col mod 格子数)，贴图用 REPEAT 寻址，所以直接用"瓦片坐标 / 格子数"取样。
 */
export function tileAtlasGlsl(name: string, functionName: string): string {
  return /* glsl */ `
uniform sampler2D u${name}Map;
uniform vec4 u${name}Bounds;
uniform vec4 u${name}Layout;
uniform float u${name}Opacity;
vec4 ${functionName}(vec2 uv) {
  float dx = uv.x - u${name}Bounds.x;
  dx -= floor(dx + 0.5);
  vec2 local = vec2(dx, uv.y - u${name}Bounds.y) / u${name}Bounds.zw;
  if (u${name}Opacity <= 0.0 || any(lessThan(local, vec2(0.0))) || any(greaterThan(local, vec2(1.0)))) return vec4(0.0);
  vec2 tile = vec2((u${name}Bounds.x + dx) * u${name}Layout.x, (1.0 - uv.y) * u${name}Layout.y);
  return texture2D(u${name}Map, tile / u${name}Layout.zw) * u${name}Opacity;
}`;
}

export interface TileAtlasUniforms {
  map: { value: THREE.Texture };
  bounds: { value: THREE.Vector4 };
  layout: { value: THREE.Vector4 };
  opacity: { value: number };
}

/** 当前窗口：第 level 级、列 left..right、行 top..bottom（列可以是负数或超过整圈，绕月一圈在取模时处理）。 */
interface TileWindow {
  level: number;
  cols: number;
  rows: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface TileRef {
  key: string;
  level: number;
  col: number;
  row: number;
  slot: number;
  /** 离窗口中心的距离平方：中间的先下、先写。 */
  distance: number;
}

interface PendingUpload {
  tile: TileRef;
  bitmap: ImageBitmap;
}

const mod = (value: number, size: number) => ((value % size) + size) % size;

export class TileAtlas {
  readonly uniforms: TileAtlasUniforms;
  private readonly placeholder = new THREE.DataTexture(new Uint8Array(4), 1, 1);
  private readonly status: HTMLParagraphElement | null;
  private store: TileSlotStore | null = null;
  /** 每个格子里此刻放着哪一块瓦片（已经真正写进显存的）；null = 空的（全透明）。 */
  private slotKeys: Array<string | null> = [];
  private level = -1;
  /** 当前窗口想要的瓦片：key → 它的格子。 */
  private readonly slotOfKey = new Map<string, number>();
  private readonly cache = new Map<string, ImageBitmap>();
  private uploads: PendingUpload[] = [];
  private pending: TileRef[] = [];
  private readonly active = new Map<string, AbortController>();
  private failed = false;
  private signature = "";
  private disposed = false;

  /** colorData：true = 瓦片是给人看的颜色（3D 里走 sRGB），false = 按原值输出（2D 着色器自己不做转换）。invalidate：有新内容时让画面重画。 */
  constructor(
    private readonly source: TileSource,
    private readonly renderer: THREE.WebGLRenderer,
    container: HTMLElement,
    private readonly colorData: boolean,
    private readonly invalidate: () => void,
  ) {
    this.placeholder.needsUpdate = true;
    this.uniforms = { map: { value: this.placeholder }, bounds: { value: new THREE.Vector4(0, 0, 1, 1) }, layout: { value: new THREE.Vector4(1, 1, 1, 1) }, opacity: { value: 0 } };
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

  /** 每次画面范围变了调用（每个画出来的帧都调用也行）。view 为 null（例如 3D 里离得太远）= 这一层不用。 */
  update(view: DetailView | null): void {
    this.trackView(view);
    this.writePendingTiles();
  }

  dispose(): void {
    this.disposed = true;
    this.abortDownloads();
    this.uploads = [];
    this.status?.remove();
    this.cache.forEach((bitmap) => bitmap.close());
    this.cache.clear();
    this.store?.dispose();
    this.placeholder.dispose();
  }

  private trackView(view: DetailView | null): void {
    const wantedLevel = view ? this.source.levelFor(view.worldWidthPx) : null;
    const opacity = view ? this.source.opacityFor(view.worldWidthPx) : 0;
    const window = view && wantedLevel !== null && opacity > 0 ? this.windowFor(view, wantedLevel) : null;
    if (!window) return this.deactivate(); // 宁可显示底图，也不用比底图更粗的瓦片盖上去
    this.uniforms.opacity.value = opacity;
    const signature = `${window.level}/${window.left}/${window.right}/${window.top}/${window.bottom}`;
    if (signature !== this.signature) this.retarget(signature, window);
  }

  /** 视野加一圈余量，选最高的、显存格子放得下的那一级。 */
  private windowFor(view: DetailView, wantedLevel: number): TileWindow | null {
    const { slotsX, slotsY, maxTilesPerAxis, minLevel, maxLevel } = this.source;
    const maxX = Math.min(maxTilesPerAxis, slotsX);
    const maxY = Math.min(maxTilesPerAxis, slotsY);
    for (let level = Math.min(maxLevel, wantedLevel); level >= minLevel; level--) {
      const cols = 2 ** (level + 1);
      const rows = 2 ** level;
      const left = Math.floor(view.west * cols) - 1;
      const right = Math.ceil(view.east * cols);
      const top = Math.max(0, Math.floor((1 - view.north) * rows) - 1);
      const bottom = Math.min(rows - 1, Math.ceil((1 - view.south) * rows));
      if (right - left + 1 <= maxX && bottom - top + 1 <= maxY) return { level, cols, rows, left, right, top, bottom };
    }
    return null;
  }

  private deactivate(): void {
    this.uniforms.opacity.value = 0;
    this.abortDownloads();
    this.uploads = [];
    this.slotOfKey.clear();
    this.signature = "";
    this.failed = false;
    this.refreshStatus(); // 显存里已经写好的瓦片留着：马上又放大回来时直接能用
  }

  /** 窗口变了：哪些格子要换、哪些瓦片要下，其余已经在显存里的原样不动。 */
  private retarget(signature: string, win: TileWindow): void {
    const store = this.ensureStore();
    if (win.level !== this.level) {
      store.clearAll(); // 换了一级，旧的瓦片在新级别里位置不对，整张清空（在显卡上清，很快）
      this.slotKeys.fill(null);
      this.level = win.level;
    }
    this.signature = signature;
    this.uploads = [];
    this.slotOfKey.clear();
    const { level, cols, rows, left, right, top, bottom } = win;
    this.uniforms.bounds.value.set(left / cols, 1 - (bottom + 1) / rows, (right - left + 1) / cols, (bottom - top + 1) / rows);
    this.uniforms.layout.value.set(cols, rows, store.slotsX, store.slotsY);

    const centerCol = (left + right) / 2;
    const centerRow = (top + bottom) / 2;
    const missing: TileRef[] = [];
    for (let row = top; row <= bottom; row++) {
      for (let col = left; col <= right; col++) {
        const realCol = mod(col, cols);
        const tile: TileRef = { key: `${level}/${row}/${realCol}`, level, col: realCol, row, slot: store.slotOf(col, row), distance: (col - centerCol) ** 2 + (row - centerRow) ** 2 };
        this.slotOfKey.set(tile.key, tile.slot);
        if (this.slotKeys[tile.slot] === tile.key) continue; // 已经在显存里，什么都不用做
        if (this.slotKeys[tile.slot] !== null) {
          store.clearSlot(tile.slot); // 格子里是别的瓦片的画面，先清掉，不能让它留在新位置上
          this.slotKeys[tile.slot] = null;
        }
        const bitmap = this.cachedBitmap(tile.key);
        if (bitmap) this.uploads.push({ tile, bitmap });
        else missing.push(tile);
      }
    }
    this.scheduleDownloads(missing);
  }

  private ensureStore(): TileSlotStore {
    if (!this.store) {
      const { tilePx, slotsX, slotsY } = this.source;
      this.store = new TileSlotStore(this.renderer, tilePx, slotsX, slotsY, this.colorData);
      this.slotKeys = new Array<string | null>(slotsX * slotsY).fill(null);
      this.uniforms.map.value = this.store.texture;
    }
    return this.store;
  }

  /** 把排队的瓦片写进显存，每帧只花一小段时间，写不完的下一帧接着写。 */
  private writePendingTiles(): void {
    const store = this.store;
    if (!store || this.uploads.length === 0) return;
    this.uploads.sort((a, b) => a.tile.distance - b.tile.distance);
    const started = performance.now();
    let wrote = false;
    while (this.uploads.length > 0 && (!wrote || performance.now() - started < UPLOAD_BUDGET_MS)) {
      const { tile, bitmap } = this.uploads.shift()!;
      if (this.slotOfKey.get(tile.key) !== tile.slot) continue; // 窗口已经移开，这块不要了
      if (bitmap.width === 0) {
        this.pending.push(tile); // 位图被内存缓存顶掉了：重新下
        this.pump();
        continue;
      }
      store.writeTile(tile.slot, bitmap);
      this.slotKeys[tile.slot] = tile.key;
      wrote = true;
    }
    if (this.uploads.length > 0) this.invalidate(); // 没写完，下一帧接着
  }

  private scheduleDownloads(missing: TileRef[]): void {
    for (const [key, controller] of this.active) {
      if (this.slotOfKey.has(key)) continue; // 还在窗口里的，让它接着下，不重来
      controller.abort();
      this.active.delete(key);
    }
    this.pending = missing.filter((tile) => !this.active.has(tile.key)).sort((a, b) => a.distance - b.distance);
    this.failed = false;
    this.pump();
    this.refreshStatus();
  }

  private pump(): void {
    while (this.active.size < PARALLEL_DOWNLOADS && this.pending.length > 0) {
      const tile = this.pending.shift()!;
      if (!this.slotOfKey.has(tile.key) || this.active.has(tile.key)) continue;
      const controller = new AbortController();
      this.active.set(tile.key, controller);
      void this.downloadTile(tile, controller);
    }
  }

  private async downloadTile(tile: TileRef, controller: AbortController): Promise<void> {
    try {
      const response = await fetch(this.source.urlFor(tile.level, tile.row, tile.col), { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(this.source.fetchTimeoutMs)]), credentials: "omit" });
      if (!response.ok) throw new Error("Imagery unavailable");
      const bitmap = await createImageBitmap(await response.blob());
      if (controller.signal.aborted || this.disposed) return bitmap.close();
      if (bitmap.width !== this.source.tilePx || bitmap.height !== this.source.tilePx) {
        bitmap.close();
        throw new Error("Unexpected tile size");
      }
      this.remember(tile.key, bitmap);
      const slot = this.slotOfKey.get(tile.key);
      if (slot !== undefined) {
        this.uploads.push({ tile: { ...tile, slot }, bitmap });
        this.invalidate();
      }
    } catch {
      if (!controller.signal.aborted && !this.disposed) this.failed = true;
    } finally {
      if (this.active.get(tile.key) === controller) this.active.delete(tile.key);
      if (!this.disposed) {
        this.pump();
        this.refreshStatus();
      }
    }
  }

  private abortDownloads(): void {
    this.active.forEach((controller) => controller.abort());
    this.active.clear();
    this.pending = [];
  }

  /** 取内存里已解码的瓦片（顺便刷新"最近使用"）；已经被顶掉关闭的当作没有。 */
  private cachedBitmap(key: string): ImageBitmap | undefined {
    const bitmap = this.cache.get(key);
    if (!bitmap) return undefined;
    this.cache.delete(key);
    if (bitmap.width === 0) return undefined;
    this.cache.set(key, bitmap);
    return bitmap;
  }

  private remember(key: string, bitmap: ImageBitmap): void {
    this.cache.set(key, bitmap);
    while (this.cache.size > this.source.cacheTiles) {
      const oldest = this.cache.keys().next().value!;
      this.cache.get(oldest)!.close();
      this.cache.delete(oldest);
    }
  }

  private refreshStatus(): void {
    if (!this.status || !this.source.statusLabel) return;
    const loading = this.active.size + this.pending.length > 0;
    this.status.textContent = loading ? this.source.statusLabel : "Detailed imagery unavailable; showing the global map.";
    this.status.hidden = !(loading || this.failed);
  }
}
