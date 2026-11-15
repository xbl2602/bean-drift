# 待办与待决问题（TODO）

> 维护人：`xbl2602`。其他人想加事项，写进自己的 `docs/logs/<用户名>/` 或 `docs/decisions/`，不要直接改本文件（避免冲突）。

## 待决问题（需要拍板，拍板后写进 DECISION_LOG）

| # | 问题 | 为什么要定 | 相关 |
|---|---|---|---|
| ~~Q1~~ | ~~L6"最长平均断电时间"、L7"平均单次信号时间"的精确公式~~ **已解决（2026-11-14）**：按次平均、圆盘上缘露出即可见、2030 全年逐小时；见 `docs/decisions/2026-11-14_xbl2602_precomputed-terrain-and-year-stats.md`。待 `xbl2602` 整理进 DECISION_LOG 后可从本表删除 | 决定预计算什么 | FEATURE_SPEC §3 |
| Q2 | 综合有效位置图（L9）的基地参数有哪些、默认值多少 | 决定 UI 和着色规则 | FEATURE_SPEC §5 |
| Q3 | 预设点位清单（中美俄等）和**有出处的**坐标。**进度（2026-11-15）**：已有 24 个，全部在 CREDITS 第 5 节登记出处：原型 4 个、阿波罗 12/14/15/16/17（NSSDCA）、嫦娥三/四/五/六号和月船三号（IAU 地名库或 LROC）、南极 10 个地名中心点（IAU，**不是着陆目标**）。**还缺**：Luna/Surveyor/SLIM/IM-1/Blue Ghost 等（没有核实过的出处，不写）；俄/印/日以外的任务。**Artemis III（2026-11-15 核实）**：9 个候选区名单已对照 NASA 官方新闻稿（2024-10-28，从 13 缩到 9：Peak near Cabeus B、Haworth、Malapert Massif、Mons Mouton Plateau、Mons Mouton、Nobile Rim 1、Nobile Rim 2、de Gerlache Rim 2、Slater Plain）核实无误，但 NASA 官方文本（新闻稿、NTRS 20250011660）只给名单和示意图，**没有逐区中心坐标**；第三方论文里的坐标是作者自选的最优点，不算官方定义。未核实前不进预设 | 用户要求预设点；坐标不能凭记忆 | FEATURE_SPEC §7 |
| Q4 | 预计算产物放哪。**进度**：已调研，见 `docs/research/tile-hosting-limits.md`。小图层（坡度/日照/通信，估算几十 MB）可跟网站放 Vercel；全月高精度地形（约 8.5 GB）放不进 Vercel 和 Supabase 免费版，候选是 Cloudflare R2（对外）+ Oracle VPS（备份）。**2026-11-14 进展**：0.25° 整月预计算（约 55 MB，含地形、地平线、一年统计）已随网站放在 `public/data/v1/`，不需要外部存储。**还没拍板**：是否做高精度地形、是否用 R2 | 影响大小限制和稳定性 | DATA_FLOW §4 |
| Q5 | 全月数据用什么 DEM、多大分辨率。**进度**：候选已选 LOLA 118 m 全月（`LDEM_256`）做地形，NASA Moon Trek 的 WAC（约 83 m/像素）做 2D 底图（见 `docs/research/nasa-trek-tiles-for-frontend.md`）。**2026-11-14 进展**：整月概览实际用了旧仓库已有的 `LDEM_64`（473.8 m/像素），0.25° 格子，全月地平线 25 秒算完（20 线程），见 decisions；更细的 DEM 是否要上，等前端用起来再定。**还差**：Trek 使用条款未确认；更高分辨率（着陆点尺度）的地平线耗时和大小没实测 | 决定"全月每点可调用"能否做到 | FEATURE_SPEC §6 |
| Q6 | **沿用的框架与原型是否要向本地组织者说明或确认？** 官方 FAQ 有一条"赛前不得开始做挑战"（见 `docs/research/lunar-landing-site-navigator_research.md` 第 1 节），而沿用的内容是活动开始之前做的，这一点没有向组织者确认过。视频和提交文档里怎么如实标注"已有基础"也要定 | 避免提交被认定违规；对评委诚实 | DECISION_LOG D-0008 |

## 近期要做

- [ ] `xbl2602`：在 GitHub 仓库设置里给 `main` 开分支保护（要求 PR 才能合并，并勾选"Require review from Code Owners"，配合 `.github/CODEOWNERS`），并开启 secret scanning（密钥泄露扫描）。
- [x] `xbl2602`：整月预计算流水线已建（`pipeline/`，`npm run data`），2026-11-14。原型 `tools/`（南极 10 m / 阿波罗 11 号 2 m 的高精度部分）还没迁。
- [x] `xbl2602`：用 NASA 官方的 LOLA 平均可见性产品对照我们的统计（2026-11-15 完成）：对照对象是 `/api/point` 现算的一年统计（160 m 极区数据），官方产品是 18.6 年平均的 `AVGVISIB_65S_240M_201608{,_EARTH}.IMG`（240 m/像素，极立体投影）。结论：40 个随机点地球可见性 RMS 0.076、太阳 RMS 0.036；13 个极区预设点里 Shackleton/Faustini/Cabeus/Haworth/de Gerlache/Slater 的太阳可见性两边都是 0（永久阴影全对上）；Amundsen 中心 0.158 vs 0.158。投影约定用整圈互相关钉死（lat −89.5°，相关 0.953）：sample=3209.5+ρ·sin(λ)，line=3209.5−ρ·cos(λ)。脚本和数字见 `pipeline/validate-vs-nasa-illumination.mjs` 与 CREDITS 第 1 节。注意：对照的是单点统计，`stats-4ppd.u16` 整月地图用的是同一套地平线逻辑但取格子中心，未逐格对照。
- [x] `xbl2602`：Dockerfile 已真正构建并运行验证（2026-11-15，main 分支，Docker Desktop 29.6.1）：多阶段构建成功，容器内 `/api/health`、`/api/point` 返回 200 且 provenance 完整。
- [ ] 前端（`ShanLe1224`）：product page 直接读 `public/data/v1/` 的静态图层，格式见 `docs/SHARED_INTERFACES.md` 2.5.1 和 `manifest.json`。
- [ ] 每个人：完成 TEAM_HANDBOOK 第 2 节的"热身提交"。
- [ ] `leeziqi0531-debug`：建立 CREDITS 登记习惯；起草 30 秒视频分镜。
- [x] **agent 频率限制**（2026-11-14 完成）：Vercel 防火墙规则 `agent-rate-limit-20-per-min`，`/api/agent` 每个 IP 每 60 秒最多 20 次，超出返回 429。已在线上实测（前 20 次通过，第 21 次起 429）。规则只存在于 Vercel 后台，参数和重建办法见 `docs/decisions/2026-11-14_xbl2602_agent-rate-limit.md`。**它限的是速度，不是总花费**：多个 IP 可以绕过，所以 DeepSeek 账号里仍建议只留少量余额。
- [ ] DeepSeek key（变量名 `DEEPSEEK_API_KEY`）：`xbl2602` 已在 Vercel 创建（AI 不碰密钥）。环境变量只对**之后的新部署**生效；验证办法：`POST /api/agent` 不再返回 503 `not_configured`。如果新部署后仍是 503，检查变量名拼写、是否勾选了 Production、值是否为空。
- [ ] 把 `AI_PLAYBOOK.md` 第 6 节"还没做、值得做的"（画质指标、固定机位 URL）转成产品里的调试工具。

## 已知限制（来自原型）

- 原型地球贴图是程序化的，不是真实 NASA 影像；岩石是程序化的；阿波罗 11 号 DTM 有一条南北向拼接缝未处理；东侧 1.2 km 外是合成地面（见 PROJECT_CONTEXT）。
