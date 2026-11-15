// 第一人称天空里太阳和地球的轨迹线（点线）：以当前时刻为中心，往前、往后各 15 天，每 2 小时一个点，每天（UTC 0 点）一个大点。
// 位置和画太阳、地球用的是同一份星历（sky-conditions.ts）。
// 太阳：一个月球日（约 29.5 天）里划过整个天空的一条弧；地球：几乎不动，只在天空里绕一个小圈（天平动，不会刚好闭合）。
//
// 平滑：采样点固定在"UTC 每 2 小时"的格子上（不跟着当前时刻挪），时间往前走时，窗口像传送带一样滑动——
// 前面一个个新点淡入、后面的旧点淡出，已有的点位置不变，所以轨迹不会突然整条跳到新位置。算过的点缓存起来，每帧最多补算几个。
// 点线和天上的太阳、地球一样放在很远的地方，跟着人走；地平线下被地形挡住。
import * as THREE from "three";
import { azElToLocal, type LatLon } from "../moon-frames";
import { skyConditionsAt } from "../sky-conditions";

const HOUR_MS = 3_600_000;
const STEP_H = 2;
const STEP_MS = STEP_H * HOUR_MS;
/** 往前、往后各取这么多小时。 */
const HALF_SPAN_H = 15 * 24;
/** 两端各有这么多小时逐渐淡出（不会在端点突然断掉）。 */
const FADE_H = 4 * 24;
/** 点数：窗口里最多会有这么多个格点。 */
const COUNT = Math.floor((2 * HALF_SPAN_H) / STEP_H) + 2;

const vertexShader = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
uniform float uPixelRatio;
varying float vAlpha;
#include <common>
#include <logdepthbuf_pars_vertex>
void main() {
  vAlpha = aAlpha;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uPixelRatio;
  #include <logdepthbuf_vertex>
}`;

const fragmentShader = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vAlpha;
#include <logdepthbuf_pars_fragment>
void main() {
  #include <logdepthbuf_fragment>
  if (vAlpha <= 0.001) discard;
  float d = length(gl_PointCoord - 0.5) * 2.0;
  gl_FragColor = vec4(uColor, uOpacity * vAlpha * (1.0 - smoothstep(0.6, 1.0, d)));
}`;

type Track = THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;

function createTrack(color: number): Track {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array(COUNT), 1));
  geometry.setAttribute("aAlpha", new THREE.BufferAttribute(new Float32Array(COUNT), 1));
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0.8 }, uPixelRatio: { value: 1 } },
    transparent: true,
    depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = -1;
  return points;
}

export interface SkyPaths {
  group: THREE.Group;
  /** 每画一帧调用：timeMs 是时间轴时刻；observer 是眼睛的位置；pixelRatio = 画布像素 / CSS 像素。 */
  update: (timeMs: number, observer: THREE.Vector3, pixelRatio: number) => void;
  dispose: () => void;
}

interface Sample { sun: THREE.Vector3; earth: THREE.Vector3 }

export function createSkyPaths(center: LatLon, distanceM: number): SkyPaths {
  const sun = createTrack(0xffd76a);
  const earth = createTrack(0x7cc4ff);
  const group = new THREE.Group();
  group.add(sun, earth);
  /** 格点编号 k 对应时刻 k × 2 小时（从 1970 年起）。 */
  const cache = new Map<number, Sample>();
  let firstIndex = Number.NaN;

  const sampleAt = (k: number): Sample => {
    let sample = cache.get(k);
    if (!sample) {
      const c = skyConditionsAt(center, k * STEP_MS);
      sample = {
        sun: azElToLocal(c.sun.azimuthDeg, c.sun.elevationDeg).multiplyScalar(distanceM),
        earth: azElToLocal(c.earth.azimuthDeg, c.earth.elevationDeg).multiplyScalar(distanceM),
      };
      cache.set(k, sample);
    }
    return sample;
  };

  /** 窗口起点换了：把这一段格点的位置、大小写进去（大部分来自缓存），并丢掉离窗口很远的缓存。 */
  const fillPositions = (k0: number) => {
    firstIndex = k0;
    const sunPos = sun.geometry.getAttribute("position") as THREE.BufferAttribute;
    const earthPos = earth.geometry.getAttribute("position") as THREE.BufferAttribute;
    const sunSize = sun.geometry.getAttribute("aSize") as THREE.BufferAttribute;
    const earthSize = earth.geometry.getAttribute("aSize") as THREE.BufferAttribute;
    for (let i = 0; i < COUNT; i++) {
      const k = k0 + i;
      const { sun: s, earth: e } = sampleAt(k);
      sunPos.setXYZ(i, s.x, s.y, s.z);
      earthPos.setXYZ(i, e.x, e.y, e.z);
      const daily = (k * STEP_H) % 24 === 0; // UTC 0 点：大点
      sunSize.setX(i, daily ? 5 : 2.4);
      earthSize.setX(i, daily ? 4 : 2);
    }
    for (const attribute of [sunPos, earthPos, sunSize, earthSize]) attribute.needsUpdate = true;
    for (const k of cache.keys()) if (k < k0 - COUNT || k > k0 + 2 * COUNT) cache.delete(k);
  };

  /** 每个点的透明度：离当前时刻越近越实，两端 FADE_H 小时里平滑淡出。 */
  const fillAlpha = (timeMs: number) => {
    const sunAlpha = sun.geometry.getAttribute("aAlpha") as THREE.BufferAttribute;
    const earthAlpha = earth.geometry.getAttribute("aAlpha") as THREE.BufferAttribute;
    for (let i = 0; i < COUNT; i++) {
      const offsetH = Math.abs((firstIndex + i) * STEP_MS - timeMs) / HOUR_MS;
      const alpha = 1 - THREE.MathUtils.smoothstep(offsetH, HALF_SPAN_H - FADE_H, HALF_SPAN_H);
      sunAlpha.setX(i, alpha);
      earthAlpha.setX(i, alpha);
    }
    sunAlpha.needsUpdate = true;
    earthAlpha.needsUpdate = true;
  };

  return {
    group,
    update(timeMs, observer, pixelRatio) {
      const k0 = Math.floor((timeMs - HALF_SPAN_H * HOUR_MS) / STEP_MS);
      if (k0 !== firstIndex) fillPositions(k0);
      fillAlpha(timeMs);
      group.position.copy(observer);
      sun.material.uniforms.uPixelRatio.value = pixelRatio;
      earth.material.uniforms.uPixelRatio.value = pixelRatio;
    },
    dispose() {
      cache.clear();
      for (const track of [sun, earth]) {
        track.geometry.dispose();
        track.material.dispose();
      }
    },
  };
}
