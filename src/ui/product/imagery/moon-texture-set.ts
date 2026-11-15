// 一个视图（2D 地图 / 3D 球）用的月面贴图，按"先粗后细"逐级换上。
//
// 数据贴图（法线、高度、坡度、极区光照）有两级：2K 粗版本先到先用，4K 细版本后台补上，到了就悄悄换掉。
// 没到的时候着色器读到的是 1×1 的中性占位图，所以任何时候着色器都有合法的贴图可读，不会黑屏也不会报错。
// 着色器用的 uniform 就是这里的 slots 对象本身，换贴图只是改 slot.value，不用重建材质。
// 3D 球里 three 自带的材质（法线贴图、位移贴图）不走 uniform，换了之后通过 onSwap 通知它们改引用。
import * as THREE from "three";
import { COARSE_TEXTURES, MOON_TEXTURES, type DataMapKey } from "../moon-texture-urls";
import { fetchTextureBlob } from "../preload/texture-blob-cache";
import type { BaseLayer } from "../map-layers";
import { decodeTexture } from "./decode-texture";

export type TextureQuality = "coarse" | "fine";
type Slot = { value: THREE.Texture };

const FINE_URLS: Record<DataMapKey, string> = { normal: MOON_TEXTURES.normal, relief: MOON_TEXTURES.relief, slope: MOON_TEXTURES.slope, polar: MOON_TEXTURES.polar };
const DATA_MAP_KEYS = Object.keys(COARSE_TEXTURES) as DataMapKey[];
const DATA_ANISOTROPY = 8;

/** 占位值：法线朝正上方、高度居中、坡度 0、"极区以外"（见 polar-light-meta.json）。 */
const PLACEHOLDER_RGBA: Record<DataMapKey, [number, number, number, number]> = {
  normal: [128, 128, 255, 255],
  relief: [128, 128, 128, 255],
  slope: [0, 0, 0, 255],
  polar: [255, 255, 0, 255],
};

const rank = (quality: TextureQuality | null) => (quality === "fine" ? 2 : quality === "coarse" ? 1 : 0);

function createPlaceholder(key: DataMapKey): THREE.DataTexture {
  const texture = new THREE.DataTexture(new Uint8Array(PLACEHOLDER_RGBA[key]), 1, 1, THREE.RGBAFormat);
  texture.needsUpdate = true;
  return texture;
}

/** 当前底图需要哪几张数据贴图的细版本（其余的 2K 就够了）。 */
export function fineMapsForLayer(base: BaseLayer): DataMapKey[] {
  switch (base) {
    case "color":
      return ["normal"];
    case "elevation":
      return ["normal", "relief"];
    case "slope":
      return ["normal", "slope"];
    default:
      return ["normal", "slope", "polar"];
  }
}

export class MoonTextureSet {
  readonly slots: Record<DataMapKey, Slot>;
  private readonly quality: Record<DataMapKey, TextureQuality | null> = { normal: null, relief: null, slope: null, polar: null };
  private readonly placeholders: Record<DataMapKey, THREE.DataTexture>;
  private readonly inflight = new Map<string, Promise<void>>();
  private colorTexture: Promise<THREE.Texture> | null = null;
  private disposed = false;

  /** onSwap：某张贴图被换成新的之后调用（用来让画面重画、让 three 自带材质改引用）。 */
  constructor(private readonly onSwap: (key: DataMapKey, texture: THREE.Texture) => void) {
    this.placeholders = { normal: createPlaceholder("normal"), relief: createPlaceholder("relief"), slope: createPlaceholder("slope"), polar: createPlaceholder("polar") };
    this.slots = {
      normal: { value: this.placeholders.normal },
      relief: { value: this.placeholders.relief },
      slope: { value: this.placeholders.slope },
      polar: { value: this.placeholders.polar },
    };
  }

  /** 4K 彩色底图。每个视图只加载一次，不再换。 */
  loadColor(colorData: boolean, anisotropy: number): Promise<THREE.Texture> {
    this.colorTexture ??= fetchTextureBlob(MOON_TEXTURES.color4k).then((blob) => decodeTexture(blob, colorData, anisotropy));
    return this.colorTexture;
  }

  /** 等到指定的数据贴图至少有这个清晰度。失败会抛错，用在"进场必须有"的贴图上。 */
  load(keys: readonly DataMapKey[], quality: TextureQuality): Promise<void> {
    return Promise.all(keys.map((key) => this.loadOne(key, quality, false))).then(() => undefined);
  }

  /** 后台悄悄补：低优先级下载，失败就算了（下次再要时会重试）。 */
  request(keys: readonly DataMapKey[], quality: TextureQuality): void {
    for (const key of keys) void this.loadOne(key, quality, true).catch(() => undefined);
  }

  private loadOne(key: DataMapKey, quality: TextureQuality, background: boolean): Promise<void> {
    if (this.disposed || rank(this.quality[key]) >= rank(quality)) return Promise.resolve();
    const id = `${key}:${quality}`;
    const pending = this.inflight.get(id);
    if (pending) return pending;
    const task = this.fetchAndSwap(key, quality, background).finally(() => this.inflight.delete(id));
    this.inflight.set(id, task);
    return task;
  }

  private async fetchAndSwap(key: DataMapKey, quality: TextureQuality, background: boolean): Promise<void> {
    const url = quality === "fine" ? FINE_URLS[key] : COARSE_TEXTURES[key];
    const texture = await decodeTexture(await fetchTextureBlob(url, background), false, DATA_ANISOTROPY);
    // 迟到的粗版本不能盖掉已经到了的细版本；视图已经关掉了也不要再换
    if (this.disposed || rank(this.quality[key]) >= rank(quality)) {
      texture.dispose();
      return;
    }
    const previous = this.slots[key].value;
    this.slots[key].value = texture;
    this.quality[key] = quality;
    this.onSwap(key, texture);
    if (previous !== this.placeholders[key]) previous.dispose();
  }

  dispose(): void {
    this.disposed = true;
    for (const key of DATA_MAP_KEYS) {
      this.slots[key].value.dispose();
      this.placeholders[key].dispose();
    }
    void this.colorTexture?.then((texture) => texture.dispose()).catch(() => undefined);
  }
}
