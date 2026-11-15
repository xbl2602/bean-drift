// 3D 月球的球面网格，切成 16 × 8 = 128 块。每一帧只画"此刻需要的"：
//   - 一定在地平线后面（被月球本体挡住）的块整块不画，不进顶点处理，也不进阴影图；
//   - 在画面之外的块，three 会用包围球自动跳过（包围球已按地形最大位移放大，所以不会误删）；
//   - 网格疏密跟着屏幕大小走：每格在屏幕上大约占 8 个像素就够了（细节由法线贴图出，几何只管轮廓和大起伏）。
//     太密的话每个三角形还不到一个像素，GPU 要为每个小三角形整块 2×2 像素都跑一遍着色器，白白浪费。
//     同一时刻所有可见的块用同一档疏密，所以块与块之间不会因为疏密不同而出现裂缝。
//
// 每块的纹理坐标直接按"整个球面"的经纬度算，所以所有块共用同一套材质和贴图，
// 接缝处位置、法线、纹理坐标完全相同。
import * as THREE from "three";

const PATCH_COLUMNS = 16;
const PATCH_ROWS = 8;
/** 每块每边的格数，从疏到密（最密 64 = 整球 1024 × 512 格，和原来一样）。 */
const DETAIL_LEVELS = [16, 32, 64] as const;
/** 屏幕上每格大约占多少像素就够了。 */
const TARGET_SEGMENT_PX = 8;
/** 疏密档位切换留的余地，避免正好卡在分界线上来回跳。 */
const SWITCH_HYSTERESIS = 0.15;

type Level = (typeof DETAIL_LEVELS)[number];

interface Patch {
  mesh: THREE.Mesh;
  column: number;
  row: number;
  /** 块中心的方向（单位向量）。 */
  direction: THREE.Vector3;
  /** 块里最远的顶点离中心方向多少弧度。 */
  angularRadiusRad: number;
  geometries: Map<Level, THREE.SphereGeometry>;
  level: Level;
}

export interface GlobePatches {
  group: THREE.Group;
  /**
   * 按相机更新哪些块要画、用哪一档疏密。
   * 返回 true：有块刚露出来或换了疏密，缓存的阴影图和它对不上，阴影图要重画。
   */
  update: (camera: THREE.PerspectiveCamera, viewportHeightPx: number) => boolean;
  /** 阴影图刚按当前可见的块重画过。 */
  markShadowRendered: () => void;
  dispose: () => void;
}

export interface GlobePatchOptions {
  radiusKm: number;
  /** 地表相对球面的最低、最高位置（km）：块的包围球要按这个放大，地平线判断也要按它保守取值。 */
  reliefMinKm: number;
  reliefMaxKm: number;
  material: THREE.Material;
  depthMaterial: THREE.Material;
}

/** 一块球面：用 three 自带的分块球面生成，再把纹理坐标改成整个球面的经纬度坐标。 */
function createPatchGeometry(radiusKm: number, column: number, row: number, segments: number, reliefMarginKm: number): THREE.SphereGeometry {
  const phiLength = (2 * Math.PI) / PATCH_COLUMNS;
  const thetaLength = Math.PI / PATCH_ROWS;
  const phiStart = column * phiLength;
  const thetaStart = row * thetaLength;
  const geometry = new THREE.SphereGeometry(radiusKm, segments, segments, phiStart, phiLength, thetaStart, thetaLength);
  const uv = geometry.getAttribute("uv") as THREE.BufferAttribute;
  const stride = segments + 1;
  for (let iy = 0; iy < stride; iy++) {
    for (let ix = 0; ix < stride; ix++) {
      const phi = phiStart + (ix / segments) * phiLength;
      const theta = thetaStart + (iy / segments) * thetaLength;
      uv.setXY(iy * stride + ix, phi / (2 * Math.PI), 1 - theta / Math.PI);
    }
  }
  uv.needsUpdate = true;
  // 位移之后的顶点离原位置最多 reliefMarginKm，包围球整体放大这么多，frustum 剔除才不会把露出画面边缘的高山误删
  geometry.computeBoundingSphere();
  geometry.boundingSphere!.radius += reliefMarginKm;
  return geometry;
}

function patchDirection(geometry: THREE.BufferGeometry): { direction: THREE.Vector3; angularRadiusRad: number } {
  const position = geometry.getAttribute("position") as THREE.BufferAttribute;
  const direction = new THREE.Vector3();
  const vertex = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) direction.add(vertex.fromBufferAttribute(position, i).normalize());
  direction.normalize();
  let angularRadiusRad = 0;
  for (let i = 0; i < position.count; i++) angularRadiusRad = Math.max(angularRadiusRad, direction.angleTo(vertex.fromBufferAttribute(position, i)));
  return { direction, angularRadiusRad };
}

export function createGlobePatches({ radiusKm, reliefMinKm, reliefMaxKm, material, depthMaterial }: GlobePatchOptions): GlobePatches {
  const group = new THREE.Group();
  const reliefMarginKm = Math.max(Math.abs(reliefMinKm), Math.abs(reliefMaxKm));
  const coarsest = DETAIL_LEVELS[0];
  const patches: Patch[] = [];
  for (let row = 0; row < PATCH_ROWS; row++) {
    for (let column = 0; column < PATCH_COLUMNS; column++) {
      const geometry = createPatchGeometry(radiusKm, column, row, coarsest, reliefMarginKm);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.customDepthMaterial = depthMaterial;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      patches.push({ mesh, column, row, ...patchDirection(geometry), geometries: new Map([[coarsest, geometry]]), level: coarsest });
    }
  }

  const geometryAt = (patch: Patch, level: Level) => {
    let geometry = patch.geometries.get(level);
    if (!geometry) {
      geometry = createPatchGeometry(radiusKm, patch.column, patch.row, level, reliefMarginKm);
      patch.geometries.set(level, geometry);
    }
    return geometry;
  };

  // 一定被挡住的判据：球体内部半径 solidKm 以内一定是实心的（地表最低处以下）；
  // 从相机（距球心 distanceKm）看向半径 farthestKm 处的点，连线被实心球挡住 ⇔ 两点夹角 > 两条切线各自的张角之和。
  const solidKm = radiusKm + reliefMinKm;
  const farthestKm = radiusKm + reliefMaxKm;
  const patchSpanKm = (2 * Math.PI * radiusKm) / PATCH_COLUMNS;
  const shadowHasPatch = new Uint8Array(patches.length);
  const cameraDirection = new THREE.Vector3();
  let level: Level = coarsest;

  /** 离相机最近的那块在屏幕上有多宽（像素），决定整体的疏密档位。 */
  const chooseLevel = (camera: THREE.PerspectiveCamera, viewportHeightPx: number, altitudeKm: number): Level => {
    const focalPx = viewportHeightPx / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const nearestPatchPx = (patchSpanKm * focalPx) / Math.max(altitudeKm, 1);
    let index = DETAIL_LEVELS.indexOf(level);
    while (index < DETAIL_LEVELS.length - 1 && nearestPatchPx / DETAIL_LEVELS[index + 1] >= TARGET_SEGMENT_PX * (1 + SWITCH_HYSTERESIS)) index++;
    while (index > 0 && nearestPatchPx / DETAIL_LEVELS[index] < TARGET_SEGMENT_PX * (1 - SWITCH_HYSTERESIS)) index--;
    return DETAIL_LEVELS[index];
  };

  const update = (camera: THREE.PerspectiveCamera, viewportHeightPx: number): boolean => {
    const distanceKm = camera.position.length();
    cameraDirection.copy(camera.position).divideScalar(distanceKm);
    const hiddenBeyondRad = Math.acos(Math.min(solidKm / distanceKm, 1)) + Math.acos(solidKm / farthestKm);
    level = chooseLevel(camera, viewportHeightPx, distanceKm - radiusKm);
    let changed = false;
    patches.forEach((patch, index) => {
      const hidden = cameraDirection.angleTo(patch.direction) - patch.angularRadiusRad > hiddenBeyondRad;
      patch.mesh.visible = !hidden;
      if (hidden) return;
      if (patch.level !== level) {
        patch.mesh.geometry = geometryAt(patch, level);
        patch.level = level;
        changed = true;
      }
      if (!shadowHasPatch[index]) changed = true;
    });
    return changed;
  };

  const markShadowRendered = () => patches.forEach((patch, index) => (shadowHasPatch[index] = patch.mesh.visible && patch.level === level ? 1 : 0));

  const dispose = () => patches.forEach((patch) => patch.geometries.forEach((geometry) => geometry.dispose()));
  return { group, update, markShadowRendered, dispose };
}
