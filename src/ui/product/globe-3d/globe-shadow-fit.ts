// 3D 球的阴影贴图只覆盖"此刻看得见的那一小块月面"，而不是整个月球。
// 拉远时看到半个月球，阴影图就铺满整个月球；放大到近处，看到的只有几百公里，阴影图就缩到这一小块上——
// 同样大小的阴影图，近处的精度能提高几十倍。这就是阴影贴图版的"远粗近细"。
//
// 为什么只管看得见的区域就够：阴影是沿太阳方向投下来的，能落在可见区域里的遮挡物，沿太阳方向看过去一定和这块区域重叠，
// 所以阴影相机只要在"垂直于太阳光"的平面上盖住可见区域即可；深度方向（沿太阳光）照常留足整个月球的范围。
//
// 阴影图只在需要时重画（update 返回 true）：太阳方向变了（拖了时间轴）、地形贴图换了、或者视野走出了当前覆盖的范围。
import * as THREE from "three";

/** 视野比刚好看到的范围多盖一圈，平移一点点不用重画阴影。 */
const COVER_MARGIN = 1.4;
/** 当前覆盖范围比需要的大出这么多倍时，重新收紧（放大镜头后提高精度）。 */
const REFINE_RATIO = 0.45;
/** 3D 里地形被夸张显示，高出球面最多这么多 km（见 globe-material.ts 的夸张倍数），阴影相机的深度范围要留出来。 */
const RELIEF_MARGIN_KM = 60;
/** 阴影法线偏移占一个阴影像素的倍数（经验值：旧版 8192 张覆盖整个月球时是 1.5 km ≈ 3.2 个像素）。 */
const NORMAL_BIAS_TEXELS = 3.2;

/** 从相机看到的月面，是以相机正下方为中心、多大角度半径的一个球冠（弧度）。 */
export function visibleCapAngleRad(cameraDistanceKm: number, fovDeg: number, aspect: number, radiusKm: number): number {
  const limbRad = Math.asin(Math.min(radiusKm / cameraDistanceKm, 1)); // 视线擦过月球边缘时偏离正前方的角度
  const diagonalRad = Math.atan(Math.tan(THREE.MathUtils.degToRad(fovDeg / 2)) * Math.sqrt(1 + aspect * aspect)); // 画面对角线的半角
  const viewRad = Math.min(diagonalRad, limbRad);
  return Math.asin(Math.min((cameraDistanceKm * Math.sin(viewRad)) / radiusKm, 1)) - viewRad;
}

/** 阴影要覆盖的角度半径：看得见的范围再放宽一圈。 */
function coverAngleFor(visibleRad: number): number {
  return Math.min(visibleRad * COVER_MARGIN + 0.02, Math.PI);
}

export class GlobeShadowFit {
  private coverDirection = new THREE.Vector3(0, 0, 1);
  private coverAngleRad = -1;
  private readonly coverSun = new THREE.Vector3();
  /** 上一次是不是直接铺满了整个月球圆盘（这时阴影图和视线方向无关，转动视角不必重画）。 */
  private coveredDisc = false;

  constructor(
    private readonly light: THREE.DirectionalLight,
    private readonly radiusKm: number,
    private readonly sunDistanceKm: number,
    private readonly mapSizePx: number,
  ) {}

  /** 摆好阴影相机；返回 true 表示阴影贴图需要重画。force：地形贴图刚换过等必须重画的情况。 */
  update(camera: THREE.PerspectiveCamera, sunDirection: THREE.Vector3, force: boolean): boolean {
    const distanceKm = camera.position.length();
    const direction = camera.position.clone().divideScalar(distanceKm);
    const visibleRad = visibleCapAngleRad(distanceKm, camera.fov, camera.aspect, this.radiusKm);
    const sunMoved = this.coverSun.distanceToSquared(sunDirection) > 1e-12;
    const wantsDisc = this.coversDisc(coverAngleFor(visibleRad));
    if (!force && !sunMoved && this.coveredDisc && wantsDisc) return false; // 整球视角：转动视角时阴影图完全不变
    const leftCover = direction.angleTo(this.coverDirection) + visibleRad > this.coverAngleRad;
    const overCovered = visibleRad < this.coverAngleRad * REFINE_RATIO;
    if (!force && !sunMoved && !leftCover && !overCovered) return false;
    this.fit(direction, visibleRad, sunDirection);
    return true;
  }

  /** 覆盖到这个角度半径时，是不是已经超过半个球面（弦长 ≥ 月球半径），直接铺满整个圆盘更简单。 */
  private coversDisc(coverRad: number): boolean {
    return 2 * this.radiusKm * Math.sin(coverRad / 2) >= this.radiusKm;
  }

  private fit(direction: THREE.Vector3, visibleRad: number, sunDirection: THREE.Vector3): void {
    const coverRad = coverAngleFor(visibleRad);
    this.coverDirection.copy(direction);
    this.coverAngleRad = coverRad;
    this.coverSun.copy(sunDirection);

    // 球冠上任意一点到冠心的直线距离不超过弦长 2R·sin(角/2)，投影到平面上只会更短，所以弦长就是边界
    const chordKm = 2 * this.radiusKm * Math.sin(coverRad / 2);
    const coversDisc = this.coversDisc(coverRad); // 覆盖超过一半球面：直接铺满整个月球圆盘
    this.coveredDisc = coversDisc;
    const halfKm = (coversDisc ? this.radiusKm : chordKm) + RELIEF_MARGIN_KM;
    const centre = new THREE.Vector3();
    if (!coversDisc) {
      centre.copy(direction).multiplyScalar(this.radiusKm);
      centre.addScaledVector(sunDirection, -centre.dot(sunDirection)); // 冠心投到"过球心、垂直太阳光"的平面上
    }

    this.light.target.position.copy(centre);
    this.light.position.copy(centre).addScaledVector(sunDirection, this.sunDistanceKm);
    const depthKm = this.radiusKm + RELIEF_MARGIN_KM;
    const shadowCamera = this.light.shadow.camera as THREE.OrthographicCamera;
    shadowCamera.left = -halfKm;
    shadowCamera.right = halfKm;
    shadowCamera.top = halfKm;
    shadowCamera.bottom = -halfKm;
    shadowCamera.near = this.sunDistanceKm - depthKm;
    shadowCamera.far = this.sunDistanceKm + depthKm;
    shadowCamera.updateProjectionMatrix();
    this.light.shadow.normalBias = ((2 * halfKm) / this.mapSizePx) * NORMAL_BIAS_TEXELS;
  }
}
