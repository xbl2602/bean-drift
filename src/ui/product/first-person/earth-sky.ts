// 第一人称天空里的地球：NASA Blue Marble 贴图的球，按真实的太阳方向打光（所以相位是真的：太阳在地球背后就是一弯新月形），
// 并且按月球上能看到的那一面来转：月球永远朝着地球的"月下点"，那个点的经纬度随时间变（地球 24 小时自转一圈）。
// 月下点用低精度月球位置算（误差约 1 到 2°，够看出非洲、美洲、亚洲哪一面朝着月球）；地轴方向取月球北极方向（近似，没有算 23.4° 的地轴倾角）。
import * as THREE from "three";

const D2R = Math.PI / 180;
const J2000_MS = 946_728_000_000;
const MS_PER_DAY = 86_400_000;
const OBLIQUITY_DEG = 23.4393;

const normalizeDeg = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180;

/** 月下点（地球上月亮正好在头顶的那一点）的纬度、经度（东经为正）。低精度：Meeus 简化月球理论 + 格林尼治恒星时。 */
export function subLunarPoint(timeMs: number): { latDeg: number; lonDeg: number } {
  const d = (timeMs - J2000_MS) / MS_PER_DAY;
  const meanLon = 218.316 + 13.176396 * d;
  const meanAnomaly = (134.963 + 13.064993 * d) * D2R;
  const argLat = (93.272 + 13.22935 * d) * D2R;
  const lambda = (meanLon + 6.289 * Math.sin(meanAnomaly)) * D2R;
  const beta = 5.128 * Math.sin(argLat) * D2R;
  const eps = OBLIQUITY_DEG * D2R;
  const rightAscensionDeg = Math.atan2(Math.sin(lambda) * Math.cos(eps) - Math.tan(beta) * Math.sin(eps), Math.cos(lambda)) / D2R;
  const declinationDeg = Math.asin(Math.sin(beta) * Math.cos(eps) + Math.cos(beta) * Math.sin(eps) * Math.sin(lambda)) / D2R;
  const gmstDeg = 280.46061837 + 360.98564736629 * d;
  return { latDeg: declinationDeg, lonDeg: normalizeDeg(rightAscensionDeg - gmstDeg) };
}

/** three 的 SphereGeometry 上，经纬度对应的点（u = 0 在西经 180°，北极在 +y）。 */
function sphereDirection(latDeg: number, lonDeg: number, into: THREE.Vector3): THREE.Vector3 {
  const phi = (lonDeg + 180) * D2R;
  const theta = (90 - latDeg) * D2R;
  return into.set(-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta));
}

export function createEarthMaterial(dayMap: THREE.Texture): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    uniforms: { uSunDirection: { value: new THREE.Vector3(1, 0, 0) }, uDayMap: { value: dayMap } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormalWorld;
      varying vec3 vWorldPosition;
      void main() {
        vUv = uv;
        vNormalWorld = normalize(mat3(modelMatrix) * normal);
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorldPosition = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uDayMap;
      uniform vec3 uSunDirection;
      varying vec2 vUv;
      varying vec3 vNormalWorld;
      varying vec3 vWorldPosition;
      void main() {
        vec3 n = normalize(vNormalWorld);
        float mu = dot(n, uSunDirection);
        // 明暗交界处柔和过渡；夜面几乎全黑，只剩一点点蓝（地球在月球天空里不会被别的东西照亮）
        float day = smoothstep(-0.04, 0.12, mu);
        float shade = day * (0.35 + 0.65 * pow(max(mu, 0.0), 0.6));
        vec3 surface = texture2D(uDayMap, vUv).rgb;
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        float rim = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0);
        // 大气：边缘一圈蓝色薄雾，向阳面更亮；明暗交界线附近偏橘红（真实的日落光线）
        vec3 atmosphere = vec3(0.16, 0.45, 1.0) * rim * (0.05 + 0.95 * day);
        float twilight = smoothstep(-0.02, 0.05, mu) * (1.0 - smoothstep(0.05, 0.22, mu));
        vec3 lit = surface * shade * 1.55 + vec3(1.0, 0.45, 0.2) * twilight * rim * 0.5;
        gl_FragColor = vec4(lit + atmosphere + surface * 0.004, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  material.toneMapped = false; // 地球有自己的亮度；不随"自动曝光"变亮变暗，夜里也一样清楚
  return material;
}

export function createEarth(dayMap: THREE.Texture): THREE.Mesh {
  const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 64), createEarthMaterial(dayMap));
  earth.renderOrder = -1;
  return earth;
}

/** 没有贴图（下载失败）时的替身：一个单色的蓝色小图，至少还是个蓝色的球。 */
export function fallbackEarthTexture(): THREE.DataTexture {
  const texture = new THREE.DataTexture(new Uint8Array([48, 96, 190, 255]), 1, 1);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function sizeEarth(earth: THREE.Mesh, angularRadiusDeg: number, skyDistanceM: number) {
  earth.scale.setScalar(skyDistanceM * Math.tan(angularRadiusDeg * D2R));
}

const tmpA = new THREE.Vector3();
const tmpN = new THREE.Vector3();
const tmpAw = new THREE.Vector3();
const tmpNw = new THREE.Vector3();
const tmpAxis = new THREE.Vector3();

/** 把 b 在垂直于 a 的方向上的分量取出来并归一化。 */
const perpendicular = (b: THREE.Vector3, a: THREE.Vector3, into: THREE.Vector3) => into.copy(b).addScaledVector(a, -b.dot(a)).normalize();

/**
 * 转动地球：让月下点那一面朝向观察者，北极朝向观察点能看到的月球北极方向。
 * observerLatDeg：观察点的纬度（月球北极在本地水平坐标里的方向是 (0, sin 纬度, -cos 纬度)，x 东、y 上、z 南）。
 * earthDirection：地球在天空里的方向（本地坐标，单位向量）。
 */
export function orientEarth(earth: THREE.Mesh, timeMs: number, observerLatDeg: number, earthDirection: THREE.Vector3, sunDirection: THREE.Vector3) {
  const { latDeg, lonDeg } = subLunarPoint(timeMs);
  sphereDirection(latDeg, lonDeg, tmpA);
  perpendicular(new THREE.Vector3(0, 1, 0), tmpA, tmpN);
  const meshFrame = new THREE.Matrix4().makeBasis(tmpA, tmpN, new THREE.Vector3().crossVectors(tmpA, tmpN));
  tmpAw.copy(earthDirection).negate(); // 从地球中心看向观察者
  tmpAxis.set(0, Math.sin(observerLatDeg * D2R), -Math.cos(observerLatDeg * D2R));
  perpendicular(tmpAxis, tmpAw, tmpNw);
  const worldFrame = new THREE.Matrix4().makeBasis(tmpAw, tmpNw, new THREE.Vector3().crossVectors(tmpAw, tmpNw));
  earth.quaternion.setFromRotationMatrix(worldFrame.multiply(meshFrame.transpose()));
  (earth.material as THREE.ShaderMaterial).uniforms.uSunDirection.value.copy(sunDirection);
}
