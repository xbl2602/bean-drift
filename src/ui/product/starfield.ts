// 背景星空（装饰用，不是真实星表：星星的位置是固定随机种子生成的，每次画面一样）。
// 为了看起来像真的夜空：
//   - 亮度按"星等"分布：暗星极多、亮星很少（每暗一等数量约 ×2.8）；
//   - 颜色按恒星温度：蓝白、白、黄白、橙、红；
//   - 约四成的星集中在一条倾斜的带子上，模拟银河；
//   - 每颗星画成柔和的小圆点（亮核 + 光晕），大小随亮度变化，并按屏幕像素密度放大，高分屏上不会糊成方块。
import * as THREE from "three";

const STAR_COLORS: Array<[weight: number, hex: number]> = [
  [0.15, 0xaabfff],
  [0.3, 0xf8f7ff],
  [0.3, 0xfff4e8],
  [0.2, 0xffd2a1],
  [0.05, 0xffb07a],
];
const MILKY_WAY_SHARE = 0.42;
const MILKY_WAY_WIDTH_DEG = 9;
const FAINTEST_MAGNITUDE = 6.5;

const vertexShader = /* glsl */ `
attribute float aSize;
attribute vec3 aColor;
uniform float uPixelRatio;
varying vec3 vColor;
#include <common>
#include <logdepthbuf_pars_vertex>
void main() {
  vColor = aColor;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uPixelRatio;
  // 第一人称用了对数深度缓冲；带上这两段，星星才会被地形正确遮挡（没开启时它们是空操作）
  #include <logdepthbuf_vertex>
}`;

const fragmentShader = /* glsl */ `
uniform float uOpacity;
varying vec3 vColor;
#include <logdepthbuf_pars_fragment>
void main() {
  #include <logdepthbuf_fragment>
  float d = length(gl_PointCoord - 0.5) * 2.0;
  // 亮核 + 很淡的光晕
  float glow = exp(-d * d * 5.0) + 0.25 * exp(-d * 3.0);
  // uOpacity < 1：变淡（白天）；> 1：颜色整体变亮（第一人称夜里）
  gl_FragColor = vec4(vColor * max(uOpacity, 1.0), glow * min(uOpacity, 1.0) * (1.0 - smoothstep(0.85, 1.0, d)));
}`;

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export type Starfield = THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;

export function createStarfield(radius: number, count = 16000): Starfield {
  const random = seededRandom(20261114);
  const gaussian = () => Math.sqrt(-2 * Math.log(random() + 1e-9)) * Math.cos(2 * Math.PI * random());
  // 银河带所在的平面：先绕 x 轴转 60°，再绕 z 轴转 30°
  const milkyWayFrame = new THREE.Matrix4().makeRotationZ(Math.PI / 6).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 3));

  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const direction = new THREE.Vector3();
  const color = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const inMilkyWay = random() < MILKY_WAY_SHARE;
    if (inMilkyWay) {
      const lon = random() * Math.PI * 2;
      const lat = (gaussian() * MILKY_WAY_WIDTH_DEG * Math.PI) / 180;
      direction.set(Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)).applyMatrix4(milkyWayFrame);
    } else {
      const z = random() * 2 - 1;
      const angle = random() * Math.PI * 2;
      const r = Math.sqrt(1 - z * z);
      direction.set(r * Math.cos(angle), z, r * Math.sin(angle));
    }
    positions.set([direction.x * radius, direction.y * radius, direction.z * radius], i * 3);

    // 星等：越小越亮。log(u)/log(2.8) 让每暗一等的数量约为 2.8 倍；银河里的星整体再暗一等。
    const magnitude = Math.max(FAINTEST_MAGNITUDE + Math.log(random() + 1e-9) / Math.log(2.8) + (inMilkyWay ? 0.6 : 0), -1);
    const brightness = Math.min(Math.max((FAINTEST_MAGNITUDE + 0.6 - magnitude) / 7.5, 0), 1); // 0 = 最暗，1 = 最亮
    sizes[i] = 2.4 + 7.5 * Math.pow(brightness, 1.5);

    let pick = random();
    let hex = STAR_COLORS[STAR_COLORS.length - 1][1];
    for (const [weight, value] of STAR_COLORS) {
      if (pick < weight) {
        hex = value;
        break;
      }
      pick -= weight;
    }
    color.setHex(hex).multiplyScalar(0.55 + 0.9 * Math.pow(brightness, 0.6));
    colors.set([color.r, color.g, color.b], i * 3);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: { uOpacity: { value: 1 }, uPixelRatio: { value: 1 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const stars: Starfield = new THREE.Points(geometry, material);
  stars.frustumCulled = false;
  return stars;
}

/** pixelRatio = 画布像素 / CSS 像素；opacity 小于 1 把星星调暗（白天），大于 1 把星星调亮。 */
export function updateStarfield(stars: Starfield, pixelRatio: number, opacity = 1) {
  stars.material.uniforms.uPixelRatio.value = pixelRatio;
  stars.material.uniforms.uOpacity.value = opacity;
}
