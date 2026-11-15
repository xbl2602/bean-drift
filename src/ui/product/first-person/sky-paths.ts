// 第一人称天空里太阳和地球的轨迹线（点线）：从当前时刻往前、往后各半个月球日，每 2 小时一个点，
// 位置和画太阳、地球用的是同一份星历（sky-conditions.ts）。每 24 小时的点画大一点，可以数出"一天走多远"。
// 太阳：一个月球日（约 29.5 天）里划过整个天空的一条弧；地球：几乎不动，只在天空里绕一个小圈（天平动）。
// 点线和天上的太阳、地球一样放在很远的地方，跟着人走；地平线以下的部分被地形挡住。
import * as THREE from "three";
import { azElToLocal, type LatLon } from "../moon-frames";
import { skyConditionsAt } from "../sky-conditions";

const HOUR_MS = 3_600_000;
/** 往前、往后各取这么多小时（共约一个月球日）。 */
const HALF_SPAN_H = 15 * 24;
const STEP_H = 2;
/** 时间轴离上次算轨迹的中心超过这么久，就重算一次（太阳的路径每天变一点点）。 */
const RECOMPUTE_AFTER_MS = 5 * 24 * HOUR_MS;

const vertexShader = /* glsl */ `
attribute float aSize;
uniform float uPixelRatio;
#include <common>
#include <logdepthbuf_pars_vertex>
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uPixelRatio;
  #include <logdepthbuf_vertex>
}`;

const fragmentShader = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
#include <logdepthbuf_pars_fragment>
void main() {
  #include <logdepthbuf_fragment>
  float d = length(gl_PointCoord - 0.5) * 2.0;
  gl_FragColor = vec4(uColor, uOpacity * (1.0 - smoothstep(0.6, 1.0, d)));
}`;

function createTrack(color: number, count: number): THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial> {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array(count), 1));
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0.75 }, uPixelRatio: { value: 1 } },
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
  /** 按时间轴更新（离上次算的中心够远才重算）；observer 是眼睛的位置；pixelRatio = 画布像素 / CSS 像素。 */
  update: (timeMs: number, observer: THREE.Vector3, pixelRatio: number) => void;
  dispose: () => void;
}

export function createSkyPaths(center: LatLon, distanceM: number): SkyPaths {
  const count = Math.floor((2 * HALF_SPAN_H) / STEP_H) + 1;
  const sun = createTrack(0xffd76a, count);
  const earth = createTrack(0x7cc4ff, count);
  const group = new THREE.Group();
  group.add(sun, earth);
  let computedFor = Number.NaN;

  const recompute = (timeMs: number) => {
    computedFor = timeMs;
    const sunPos = sun.geometry.getAttribute("position") as THREE.BufferAttribute;
    const earthPos = earth.geometry.getAttribute("position") as THREE.BufferAttribute;
    const sunSize = sun.geometry.getAttribute("aSize") as THREE.BufferAttribute;
    const earthSize = earth.geometry.getAttribute("aSize") as THREE.BufferAttribute;
    const start = timeMs - HALF_SPAN_H * HOUR_MS;
    for (let i = 0; i < count; i++) {
      const t = start + i * STEP_H * HOUR_MS;
      const c = skyConditionsAt(center, t);
      const s = azElToLocal(c.sun.azimuthDeg, c.sun.elevationDeg).multiplyScalar(distanceM);
      const e = azElToLocal(c.earth.azimuthDeg, c.earth.elevationDeg).multiplyScalar(distanceM);
      sunPos.setXYZ(i, s.x, s.y, s.z);
      earthPos.setXYZ(i, e.x, e.y, e.z);
      const daily = ((i * STEP_H) % 24) === 0; // 每 24 小时一个大点
      sunSize.setX(i, daily ? 5 : 2.4);
      earthSize.setX(i, daily ? 4 : 2);
    }
    for (const attribute of [sunPos, earthPos, sunSize, earthSize]) attribute.needsUpdate = true;
  };

  return {
    group,
    update(timeMs, observer, pixelRatio) {
      if (!(Math.abs(timeMs - computedFor) < RECOMPUTE_AFTER_MS)) recompute(timeMs);
      group.position.copy(observer);
      sun.material.uniforms.uPixelRatio.value = pixelRatio;
      earth.material.uniforms.uPixelRatio.value = pixelRatio;
    },
    dispose() {
      for (const track of [sun, earth]) {
        track.geometry.dispose();
        track.material.dispose();
      }
    },
  };
}
