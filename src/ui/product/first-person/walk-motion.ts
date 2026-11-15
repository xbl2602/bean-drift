// 第一人称里"走动"的运动学：按住键（或屏幕上的方向键）往前后左右走。
// 起步和停下都是平滑的：速度经过两级平滑（目标速度 → 中间量 → 实际速度），实际速度连续且变化率也连续，
// 所以位置二阶导连续，不会一按键就猛地一冲。眼睛的高度同样两级平滑地跟着地面起伏。
// 只能在着陆点周围 WALK_LIMIT_M 内走：再远网格变粗、近处细节也没有了；快到边上时会自然减速停下。

/** 着陆点周围能走的范围（米）。近处示意细节铺到约 2.6 km，网格在 2 km 处约 50 m 一格。 */
export const WALK_LIMIT_M = 2000;
const SLOW_ZONE_M = 250;
const WALK_SPEED_MPS = 6;
const RUN_FACTOR = 4;
const VELOCITY_TAU_S = 0.12;
const GROUND_TAU_S = 0.08;
const MAX_SINK_M = 1;

/** 方向输入：forward 前 +1 / 后 -1，right 右 +1 / 左 -1。 */
export interface WalkInput { forward: number; right: number; run: boolean }

export interface FeetPosition { eastM: number; northM: number; groundYM: number }

export class WalkMotion {
  eastM = 0;
  northM = 0;
  /** 平滑后的地面高度 y（本地坐标）。 */
  groundYM: number;
  private mid = { e: 0, n: 0 };
  private vel = { e: 0, n: 0 };
  private groundMid: number;

  constructor(startGroundYM: number) {
    this.groundYM = startGroundYM;
    this.groundMid = startGroundYM;
  }

  get distanceM() { return Math.hypot(this.eastM, this.northM); }

  /** 推进 dtS 秒。yawDeg 是此刻朝向（罗盘方位）；眼睛越高走得越快（从高处看时 6 m/s 太慢）。 */
  step(dtS: number, input: WalkInput, yawDeg: number, eyeHeightM: number, surfaceYAt: (eastM: number, northM: number) => number): FeetPosition {
    const dt = Math.min(Math.max(dtS, 0), 0.1); // 切到后台再回来时不要一下跳很远
    const yaw = (yawDeg * Math.PI) / 180;
    const speed = WALK_SPEED_MPS * Math.max(1, eyeHeightM / 20) * (input.run ? RUN_FACTOR : 1);
    const length = Math.hypot(input.forward, input.right) || 1;
    // 前方 = (sin yaw, cos yaw)，右方 = (cos yaw, -sin yaw)（东、北分量）
    let te = ((Math.sin(yaw) * input.forward + Math.cos(yaw) * input.right) / length) * speed;
    let tn = ((Math.cos(yaw) * input.forward - Math.sin(yaw) * input.right) / length) * speed;
    // 快到范围边上：往外走的分量逐渐减到 0（往回走不受影响）
    const r = this.distanceM;
    if (r > 1e-6) {
      const oe = this.eastM / r;
      const on = this.northM / r;
      const outward = te * oe + tn * on;
      const brake = smoothstep(WALK_LIMIT_M - SLOW_ZONE_M, WALK_LIMIT_M, r);
      if (outward > 0) {
        te -= oe * outward * brake;
        tn -= on * outward * brake;
      }
    }
    const k = 1 - Math.exp(-dt / VELOCITY_TAU_S);
    this.mid.e += (te - this.mid.e) * k;
    this.mid.n += (tn - this.mid.n) * k;
    this.vel.e += (this.mid.e - this.vel.e) * k;
    this.vel.n += (this.mid.n - this.vel.n) * k;
    this.eastM += this.vel.e * dt;
    this.northM += this.vel.n * dt;
    const after = this.distanceM;
    if (after > WALK_LIMIT_M) {
      // 保险：数值上越界就放回边上
      this.eastM *= WALK_LIMIT_M / after;
      this.northM *= WALK_LIMIT_M / after;
    }
    const g = 1 - Math.exp(-dt / GROUND_TAU_S);
    const surfaceM = surfaceYAt(this.eastM, this.northM);
    this.groundMid += (surfaceM - this.groundMid) * g;
    this.groundYM += (this.groundMid - this.groundYM) * g;
    // 保险：快速跑上陡坡时平滑会稍微落后，脚下最多比真实地面低 MAX_SINK_M，眼睛不会钻进地里
    this.groundYM = Math.max(this.groundYM, surfaceM - MAX_SINK_M);
    return { eastM: this.eastM, northM: this.northM, groundYM: this.groundYM };
  }

  /** 回到着陆点（瞬间回去，不是走回去）。 */
  reset(startGroundYM: number) {
    this.eastM = 0;
    this.northM = 0;
    this.mid = { e: 0, n: 0 };
    this.vel = { e: 0, n: 0 };
    this.groundYM = startGroundYM;
    this.groundMid = startGroundYM;
  }
}

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
}
