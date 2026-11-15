// Globe-only sky: NASA Earth imagery and a NASA/SDO false-colour solar disc.
// Positions follow the ephemeris; apparent sizes are enlarged for visibility. Imagery is fixed.
import * as THREE from "three";
import { glowTexture } from "../first-person/sky-objects";
import { bodyToThree, earthDirectionBody } from "../moon-frames";
import { decodeTexture } from "../imagery/decode-texture";
import { SKY_TEXTURES } from "../moon-texture-urls";
import { fetchTextureBlob } from "../preload/texture-blob-cache";
import { createStarfield, updateStarfield } from "../starfield";
import { createEarthMaterial } from "./earth-material";

const SKY_DISTANCE_KM = 90_000;
const SUN_ANGULAR_RADIUS_DEG = 0.8; // Reduced presentation size; direction remains physical
const EARTH_ANGULAR_RADIUS_DEG = 1.9; // Reduced presentation size; direction remains physical

export interface GlobeSky {
  group: THREE.Group;
  ready: Promise<void>;
  update: (camera: THREE.Camera, timeMs: number, pixelRatio: number, sunDirection: THREE.Vector3) => void;
  dispose: () => void;
}

/** invalidate：天空贴图下好后让画面重画一次（3D 球只在有变化时才画）。 */
export function createGlobeSky(renderer: THREE.WebGLRenderer, invalidate: () => void): GlobeSky {
  const group = new THREE.Group();
  const stars = createStarfield(120_000);
  const textures: THREE.Texture[] = [];
  let disposed = false;
  // 走和其它贴图同一份下载缓存：首页预载过的话，这里直接用
  const load = async (url: string) => {
    const texture = await decodeTexture(await fetchTextureBlob(url), true, Math.min(8, renderer.capabilities.getMaxAnisotropy()));
    if (disposed) { texture.dispose(); return null; }
    textures.push(texture);
    return texture;
  };

  const glow = glowTexture();
  textures.push(glow);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, opacity: 0.22, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }));
  const sunDiscKm = SKY_DISTANCE_KM * Math.tan(THREE.MathUtils.degToRad(SUN_ANGULAR_RADIUS_DEG)) * 2;
  halo.scale.setScalar(sunDiscKm / 0.16);
  // The SDO frame includes the corona and a black border. Additive blending removes black.
  // Radial alpha excludes the archive timestamp and the square frame; credits remain in the UI.
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = maskCanvas.height = 256;
  const ctx = maskCanvas.getContext("2d")!;
  const mask = ctx.createRadialGradient(128, 128, 256 * 0.42, 128, 128, 256 * 0.46);
  mask.addColorStop(0, "white");
  mask.addColorStop(1, "black");
  ctx.fillStyle = mask;
  ctx.fillRect(0, 0, 256, 256);
  const sunMask = new THREE.CanvasTexture(maskCanvas);
  textures.push(sunMask);
  const sunMaterial = new THREE.SpriteMaterial({ alphaMap: sunMask, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending });
  const sun = new THREE.Sprite(sunMaterial);
  sun.visible = false;
  sun.scale.setScalar(sunDiscKm / 0.78);

  const earthMaterial = createEarthMaterial();
  const earth = new THREE.Mesh(new THREE.SphereGeometry(SKY_DISTANCE_KM * Math.tan(THREE.MathUtils.degToRad(EARTH_ANGULAR_RADIUS_DEG)), 96, 64), earthMaterial);
  earth.visible = false;
  // A faint blue halo makes the Earth readable against the black sky.
  const earthHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0x44aaff, opacity: 0.16, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }));
  earthHalo.scale.setScalar(SKY_DISTANCE_KM * Math.tan(THREE.MathUtils.degToRad(EARTH_ANGULAR_RADIUS_DEG)) * 2 / 0.3);
  group.add(stars, halo, sun, earthHalo, earth);
  // 地球和太阳在画面里只有一百来像素，用 2K / 1K 的小图就够了；它们不挡进场，下好了再出现
  const ready = Promise.all([
    load(SKY_TEXTURES.earth).then((texture) => {
      if (!texture) return;
      texture.wrapS = THREE.RepeatWrapping;
      earthMaterial.uniforms.uDayMap.value = texture;
      earth.visible = true;
      invalidate();
    }),
    load(SKY_TEXTURES.sun).then((texture) => {
      if (!texture) return;
      sunMaterial.map = texture;
      sunMaterial.needsUpdate = true;
      sun.visible = true;
      invalidate();
    }),
  ]).then(() => undefined);

  return {
    group,
    ready,
    update(camera, timeMs, pixelRatio, sunDirection) {
      group.position.copy(camera.position);
      sun.position.copy(sunDirection).multiplyScalar(SKY_DISTANCE_KM);
      halo.position.copy(sun.position);
      earth.position.copy(bodyToThree(earthDirectionBody(timeMs))).multiplyScalar(SKY_DISTANCE_KM);
      earthHalo.position.copy(earth.position);
      earthHalo.visible = earth.visible;
      earthMaterial.uniforms.uSunDirection.value.copy(sunDirection);
      updateStarfield(stars, pixelRatio);
    },
    dispose() {
      disposed = true;
      textures.forEach((texture) => texture.dispose());
      group.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.Sprite) {
          // Sprite geometry is shared by three.js; only dispose geometries we created.
          if (!(object instanceof THREE.Sprite)) object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
    },
  };
}
