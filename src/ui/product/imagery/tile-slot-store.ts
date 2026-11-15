// 显存里一张常驻的大贴图，切成 slotsX × slotsY 个格子，每格放一块瓦片。
// 只改动单个格子：新瓦片到了只写它自己那一格（约 1 MB），平移时只补新进来的格子，
// 整张贴图从来不整体重传。（上一版用 2D 画布拼图，每次范围一动就整张重新分配、重传，一次几十到上百毫秒，放大缩小时会卡。）
//
// 瓦片 (col, row) 固定放在格子 (col mod slotsX, row mod slotsY)，和当前看哪一块无关。
// 贴图用 REPEAT 寻址：着色器只管用"瓦片坐标 / 格子数"取样，绕回去的接缝由硬件处理，双线性插值跨瓦片边界也是连续的。
// slotsX 必须是 2 的幂（整圈的列数也是 2 的幂，所以绕月一圈对得上）。
import * as THREE from "three";

const mod = (value: number, size: number) => ((value % size) + size) % size;

export class TileSlotStore {
  readonly texture: THREE.Texture;
  private readonly target: THREE.WebGLRenderTarget;
  /** 只当"搬运单"用：把瓦片交给 three 做局部上传，自己从不单独上传。 */
  private readonly carrier = new THREE.Texture();
  private readonly position = new THREE.Vector2();
  private readonly clearColor = new THREE.Color();

  /** colorData：true = 瓦片是给人看的颜色（显存按 sRGB 存、取样时硬件自动转线性）；false = 原值。 */
  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    readonly tilePx: number,
    readonly slotsX: number,
    readonly slotsY: number,
    colorData: boolean,
  ) {
    this.target = new THREE.WebGLRenderTarget(slotsX * tilePx, slotsY * tilePx, {
      depthBuffer: false,
      stencilBuffer: false,
      generateMipmaps: false,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.RepeatWrapping,
      wrapT: THREE.RepeatWrapping,
      colorSpace: colorData ? THREE.SRGBColorSpace : THREE.NoColorSpace,
    });
    this.texture = this.target.texture;
    renderer.initRenderTarget(this.target); // 先在显存里分配好，才能往里做局部上传
    this.clearAll();
  }

  slotOf(col: number, row: number): number {
    return mod(row, this.slotsY) * this.slotsX + mod(col, this.slotsX);
  }

  /** 整张清成全透明（没到的瓦片就是透明，下面的底图会透出来）。在显卡上完成，不走 CPU。 */
  clearAll(): void {
    this.clear(null);
  }

  /** 把一个格子清成全透明：它原来放的瓦片已经不对了，不能让旧画面留在新位置上。 */
  clearSlot(slot: number): void {
    this.clear(slot);
  }

  /** 只把这一块瓦片写进它的格子；位图尺寸必须正好是 tilePx。 */
  writeTile(slot: number, bitmap: ImageBitmap): void {
    this.position.set((slot % this.slotsX) * this.tilePx, Math.floor(slot / this.slotsX) * this.tilePx);
    this.carrier.image = bitmap;
    try {
      this.renderer.copyTextureToTexture(this.carrier, this.texture, null, this.position);
    } finally {
      this.carrier.image = null;
    }
  }

  dispose(): void {
    this.target.dispose();
    this.carrier.dispose();
  }

  private clear(slot: number | null): void {
    const { renderer, target } = this;
    const previousTarget = renderer.getRenderTarget();
    const previousAlpha = renderer.getClearAlpha();
    renderer.getClearColor(this.clearColor);
    const previousColor = this.clearColor.getHex();
    if (slot === null) {
      target.scissorTest = false;
    } else {
      target.scissor.set((slot % this.slotsX) * this.tilePx, Math.floor(slot / this.slotsX) * this.tilePx, this.tilePx, this.tilePx);
      target.scissorTest = true;
    }
    renderer.setRenderTarget(target);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, false, false);
    renderer.setClearColor(previousColor, previousAlpha);
    renderer.setRenderTarget(previousTarget);
    target.scissorTest = false;
  }
}
