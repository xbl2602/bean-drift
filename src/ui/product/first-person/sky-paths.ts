// 第一人称天空里太阳和地球的轨迹线：以当前时刻为中心，往前、往后各 15 天，每 2 小时一个点，每天（UTC 0 点）一个大点。
// 位置和画太阳、地球用的是同一份星历（sky-conditions.ts）。
// 太阳：一个月球日（约 29.5 天）里划过整个天空的一条弧；地球：几乎不动，只在天空里绕一个小圈（天平动，不会刚好闭合）。
//
// 看得见的部分画成点线；被山、坑壁挡住的部分（以及刚落到地平线下的一小段）用同样颜色的长虚线画出来，透过地形也能看到它往哪走。
// 做法：同一条轨迹画两遍，第二遍只在"被地形挡住"的像素上画（深度测试反过来），并加密成小点连成一段段虚线。
//
// 平滑：采样点固定在"UTC 每 2 小时"的格子上（不跟着当前时刻挪），时间往前走时，窗口像传送带一样滑动——
// 前面的新点淡入、后面的旧点淡出，已有的点位置不变，所以轨迹不会突然整条跳到新位置；虚线的分段也固定在格子上，不会"爬动"。
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
/** 被挡住的部分：每两个格点之间插这么多个小点，连成虚线。 */
const SUB = 5;
const HIDDEN_COUNT = (COUNT - 1) * SUB + 1;
/** 地平线下多深以内还画虚线（再往下就是"夜里在脚下"，画出来只会乱）。 */
const HIDDEN_MIN_ELEVATION_DEG = -6;

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

type Points = THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;

function createPoints(color: number, count: number, opacity: number, hidden: boolean): Points {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array(count), 1));
  geometry.setAttribute("aAlpha", new THREE.BufferAttribute(new Float32Array(count), 1));
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity }, uPixelRatio: { value: 1 } },
    transparent: true,
    depthWrite: false,
    // 被挡住的那一遍：只在"前面已经有东西（地形）"的像素上画
    depthFunc: hidden ? THREE.GreaterDepth : THREE.LessEqualDepth,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = hidden ? 10 : -1; // 被挡住的那一遍必须在地形画完之后画
  return points;
}

/** 一条轨迹（太阳或地球）的外观。 */
interface TrackStyle {
  color: number;
  dotSize: number;
  dailyDotSize: number;
  dashDotSize: number;
  /** 虚线：每 dashOn 个格点画、接着 dashOff 个格点空（太阳每格约 1°、地球每格约 0.1°，所以两者不同）。 */
  dashOn: number;
  dashOff: number;
}

const SUN_STYLE: TrackStyle = { color: 0xffd76a, dotSize: 2.4, dailyDotSize: 5, dashDotSize: 2.2, dashOn: 3, dashOff: 2 };
const EARTH_STYLE: TrackStyle = { color: 0x7cc4ff, dotSize: 2, dailyDotSize: 4, dashDotSize: 2, dashOn: 14, dashOff: 9 };

interface Track { style: TrackStyle; visible: Points; hidden: Points }

const createTrack = (style: TrackStyle): Track => ({
  style,
  visible: createPoints(style.color, COUNT, 0.8, false),
  hidden: createPoints(style.color, HIDDEN_COUNT, 0.6, true),
});

export interface SkyPaths {
  group: THREE.Group;
  /** 每画一帧调用：timeMs 是时间轴时刻；observer 是眼睛的位置；pixelRatio = 画布像素 / CSS 像素。 */
  update: (timeMs: number, observer: THREE.Vector3, pixelRatio: number) => void;
  dispose: () => void;
}

interface Sample { sun: THREE.Vector3; earth: THREE.Vector3 }

export function createSkyPaths(center: LatLon, distanceM: number): SkyPaths {
  const sun = createTrack(SUN_STYLE);
  const earth = createTrack(EARTH_STYLE);
  const tracks: Array<[Track, keyof Sample]> = [[sun, "sun"], [earth, "earth"]];
  const group = new THREE.Group();
  for (const [track] of tracks) group.add(track.visible, track.hidden);
  /** 格点编号 k 对应时刻 k × 2 小时（从 1970 年起）。 */
  const cache = new Map<number, Sample>();
  let firstIndex = Number.NaN;
  /** 每个虚线小点相对第一个格点的位置（单位：格），算透明度时用。 */
  const hiddenStep = new Float32Array(HIDDEN_COUNT);
  for (let n = 0; n < HIDDEN_COUNT; n++) hiddenStep[n] = n / SUB;
  /** 虚线小点所在高度角带来的透明度（地平线下太深就不画），每条轨迹一份。 */
  const hiddenElevationAlpha = new Map<Track, Float32Array>(tracks.map(([track]) => [track, new Float32Array(HIDDEN_COUNT)]));

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

  const point = new THREE.Vector3();
  /** 窗口起点换了：写入格点（看得见的点）和加密后的虚线小点的位置、大小。 */
  const fillPositions = (k0: number) => {
    firstIndex = k0;
    for (const [track, body] of tracks) {
      const { style } = track;
      const pos = track.visible.geometry.getAttribute("position") as THREE.BufferAttribute;
      const size = track.visible.geometry.getAttribute("aSize") as THREE.BufferAttribute;
      const hPos = track.hidden.geometry.getAttribute("position") as THREE.BufferAttribute;
      const hSize = track.hidden.geometry.getAttribute("aSize") as THREE.BufferAttribute;
      const hElevation = hiddenElevationAlpha.get(track)!;
      const period = style.dashOn + style.dashOff;
      for (let i = 0; i < COUNT; i++) {
        const k = k0 + i;
        const p = sampleAt(k)[body];
        pos.setXYZ(i, p.x, p.y, p.z);
        size.setX(i, (k * STEP_H) % 24 === 0 ? style.dailyDotSize : style.dotSize);
        if (i === COUNT - 1) continue;
        const next = sampleAt(k + 1)[body];
        const dash = (((k % period) + period) % period) < style.dashOn; // 分段固定在格子上，窗口滑动时不会爬动
        for (let j = 0; j < SUB; j++) {
          const n = i * SUB + j;
          point.lerpVectors(p, next, j / SUB).setLength(distanceM);
          hPos.setXYZ(n, point.x, point.y, point.z);
          hSize.setX(n, dash ? style.dashDotSize : 0);
          const elevationDeg = Math.asin(THREE.MathUtils.clamp(point.y / distanceM, -1, 1)) * THREE.MathUtils.RAD2DEG;
          // 虚线的空档处透明度直接为 0（不靠点大小为 0，有的显卡仍会画出 1 个像素）
          hElevation[n] = dash ? THREE.MathUtils.smoothstep(elevationDeg, HIDDEN_MIN_ELEVATION_DEG, HIDDEN_MIN_ELEVATION_DEG + 3) : 0;
        }
      }
      const last = sampleAt(k0 + COUNT - 1)[body];
      hPos.setXYZ(HIDDEN_COUNT - 1, last.x, last.y, last.z);
      hSize.setX(HIDDEN_COUNT - 1, 0);
      for (const attribute of [pos, size, hPos, hSize]) attribute.needsUpdate = true;
    }
    for (const k of cache.keys()) if (k < k0 - COUNT || k > k0 + 2 * COUNT) cache.delete(k);
  };

  /** 离当前时刻越近越实，两端 FADE_H 小时里平滑淡出。 */
  const windowAlpha = (gridOffset: number, timeMs: number) => {
    const offsetH = Math.abs((firstIndex + gridOffset) * STEP_MS - timeMs) / HOUR_MS;
    return 1 - THREE.MathUtils.smoothstep(offsetH, HALF_SPAN_H - FADE_H, HALF_SPAN_H);
  };

  const fillAlpha = (timeMs: number) => {
    for (const [track] of tracks) {
      const alpha = track.visible.geometry.getAttribute("aAlpha") as THREE.BufferAttribute;
      for (let i = 0; i < COUNT; i++) alpha.setX(i, windowAlpha(i, timeMs));
      const hAlpha = track.hidden.geometry.getAttribute("aAlpha") as THREE.BufferAttribute;
      const hElevation = hiddenElevationAlpha.get(track)!;
      for (let n = 0; n < HIDDEN_COUNT; n++) hAlpha.setX(n, windowAlpha(hiddenStep[n], timeMs) * hElevation[n]);
      alpha.needsUpdate = true;
      hAlpha.needsUpdate = true;
    }
  };

  return {
    group,
    update(timeMs, observer, pixelRatio) {
      const k0 = Math.floor((timeMs - HALF_SPAN_H * HOUR_MS) / STEP_MS);
      if (k0 !== firstIndex) fillPositions(k0);
      fillAlpha(timeMs);
      group.position.copy(observer);
      for (const [track] of tracks) {
        track.visible.material.uniforms.uPixelRatio.value = pixelRatio;
        track.hidden.material.uniforms.uPixelRatio.value = pixelRatio;
      }
    },
    dispose() {
      cache.clear();
      for (const [track] of tracks) {
        for (const points of [track.visible, track.hidden]) {
          points.geometry.dispose();
          points.material.dispose();
        }
      }
    },
  };
}
