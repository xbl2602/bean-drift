# 待办与待决问题（TODO）

> 维护人：`xbl2602`。其他人想加事项，写进自己的 `docs/logs/<用户名>/` 或 `docs/decisions/`，不要直接改本文件（避免冲突）。

## 待决问题（需要拍板，拍板后写进 DECISION_LOG）

| # | 问题 | 为什么要定 | 相关 |
|---|---|---|---|
| ~~Q1~~ | 已解决，见 DECISION_LOG D-0017 | | |
| Q2 | 综合有效位置图（L9）的基地参数有哪些、默认值多少 | 决定 UI 和着色规则 | FEATURE_SPEC §5 |
| Q3 | 预设点位清单（中美俄等）和**有出处的**坐标。**进度（2026-11-15）**：已有 48 个（11 月 15 日补过三次），全部在 CREDITS 第 5 节登记出处：原型 4 个、阿波罗 12/14/15/16/17（NSSDCA）、嫦娥三/四/五/六号和月船三号（IAU 地名库或 LROC）、IM-1 和 IM-2（NASA/LROC 页面，南极）、SLIM 和 Blue Ghost 1（NASA/LROC 页面）、勘测者 1/3/5/6/7 和月球 16/17/20/21/23/24（LROC 2016 坐标表）、月球 9/13（维基百科人造物体清单，**精度约 300 m，待复核**）、南极 17 个地名中心点（IAU，**不是着陆目标**）。点位有 `kind` 字段：`landing-site` 着陆过的任务 / `place` 地名。**还缺**：已计划但没公布精确着陆点的任务（嫦娥七号、月船四号、月球 27、Griffin 等，**不写**）、着陆失败的（月球 25、月船二号、Hakuto-R、Beresheet，没收）。注意：AI 的预设卡片最多画 50 个，现在 48 个，再加要先放宽 `presetsVisualSchema`（`src/features/agent-search/ui/visual-data.ts`，louis068 的目录）。**Artemis III（2026-11-15 核实）**：9 个候选区名单已对照 NASA 官方新闻稿（2024-10-28，从 13 缩到 9：Peak near Cabeus B、Haworth、Malapert Massif、Mons Mouton Plateau、Mons Mouton、Nobile Rim 1、Nobile Rim 2、de Gerlache Rim 2、Slater Plain）核实无误，但 NASA 官方文本（新闻稿、NTRS 20250011660）只给名单和示意图，**没有逐区中心坐标**；第三方论文里的坐标是作者自选的最优点，不算官方定义。未核实前不进预设 | 用户要求预设点；坐标不能凭记忆 | FEATURE_SPEC §7 |
| Q4 | 预计算产物放哪。**进度**：已调研，见 `docs/research/tile-hosting-limits.md`。小图层（坡度/日照/通信，估算几十 MB）可跟网站放 Vercel；全月高精度地形（约 8.5 GB）放不进 Vercel 和 Supabase 免费版，候选是 Cloudflare R2（对外）+ Oracle VPS（备份）。**2026-11-14 进展**：0.25° 整月预计算（约 55 MB，含地形、地平线、一年统计）已随网站放在 `public/data/v1/`，不需要外部存储。**还没拍板**：是否做高精度地形、是否用 R2 | 影响大小限制和稳定性 | DATA_FLOW §4 |
| Q5 | 全月数据用什么 DEM、多大分辨率。**进度**：候选已选 LOLA 118 m 全月（`LDEM_256`）做地形，NASA Moon Trek 的 WAC（约 83 m/像素）做 2D 底图（见 `docs/research/nasa-trek-tiles-for-frontend.md`）。**2026-11-14 进展**：整月概览实际用了旧仓库已有的 `LDEM_64`（473.8 m/像素），0.25° 格子，全月地平线 25 秒算完（20 线程），见 decisions；更细的 DEM 是否要上，等前端用起来再定。**还差**：Trek 使用条款未确认；更高分辨率（着陆点尺度）的地平线耗时和大小没实测 | 决定"全月每点可调用"能否做到 | FEATURE_SPEC §6 |
| Q6 | **沿用的框架与原型是否要向本地组织者说明或确认？** 官方 FAQ 有一条"赛前不得开始做挑战"（见 `docs/research/lunar-landing-site-navigator_research.md` 第 1 节），而沿用的内容是活动开始之前做的，这一点没有向组织者确认过。视频和提交文档里怎么如实标注"已有基础"也要定 | 避免提交被认定违规；对评委诚实 | DECISION_LOG D-0008 |

| Q7 | **产品页极区地图颜色要不要换成 160 m 同源数据？** 现在极区光照图只有约 1.9 km 细节，而点位卡（`/api/point`）在 80°S 以南已是 160 m，两边数字会对不上（例：Mons Malapert 点位卡太阳比例 8.5% → 42.3%，地图颜色不会跟着变）。要换，需要 pipeline 出极区光照图层，再由夏娜接前端 | 避免同一个点地图和卡片说法不一样 | D-0028 |
| ~~Q8~~ | 已解决（2026-11-15）：产品页 Landing Sites 模式改读 `/api/presets`，见 `decisions/2026-11-15_xbl2602_more-presets-and-product-list.md` | | |
| Q9 | DeepSeek 封装位置：AGENTS.md 5.4 写的是 `src/lib/llm/`，实际在 `src/features/agent-search/api/deepseek.ts`。搬，还是改规则 | 规则和代码一致 | AGENTS.md 5.4、12 |
| Q10 | 整月图层 L4–L7 和地球可见、同时可见图层何时做（前端读 `public/data/v1/`）；南极"按条件找位置"做成 160 m（要现算约 1134 万格）建议**不做**，在文档里标明仍是 0.25° | 赛题核心是通信，但按第 13 节排在核心体验和视频之后 | FEATURE_SPEC §3、D-0028 |

## 近期要做

- [ ] `xbl2602`：在 GitHub 仓库设置里给 `main` 开分支保护（要求 PR 才能合并，并勾选"Require review from Code Owners"，配合 `.github/CODEOWNERS`），并开启 secret scanning（密钥泄露扫描）。
- [x] `xbl2602`：整月预计算流水线已建（`pipeline/`，`npm run data`），2026-11-14。原型 `tools/`（南极 10 m / 阿波罗 11 号 2 m 的高精度部分）还没迁。
- [x] `xbl2602`：用 NASA 官方的 LOLA 平均可见性产品对照我们的统计（2026-11-15 完成）：对照对象是 `/api/point` 现算的一年统计（160 m 极区数据），官方产品是 18.6 年平均的 `AVGVISIB_65S_240M_201608{,_EARTH}.IMG`（240 m/像素，极立体投影）。结论：40 个随机点地球可见性 RMS 0.076、太阳 RMS 0.036；13 个极区预设点里 Shackleton/Faustini/Cabeus/Haworth/de Gerlache/Slater 的太阳可见性两边都是 0（永久阴影全对上）；Amundsen 中心 0.158 vs 0.158。投影约定用整圈互相关钉死（lat −89.5°，相关 0.953）：sample=3209.5+ρ·sin(λ)，line=3209.5−ρ·cos(λ)。脚本和数字见 `pipeline/validate-vs-nasa-illumination.mjs` 与 CREDITS 第 1 节。注意：对照的是单点统计，`stats-4ppd.u16` 整月地图用的是同一套地平线逻辑但取格子中心，未逐格对照。
- [x] `xbl2602`：Dockerfile 已真正构建并运行验证（2026-11-15，main 分支，Docker Desktop 29.6.1）：多阶段构建成功，容器内 `/api/health`、`/api/point` 返回 200 且 provenance 完整。
- [ ] 前端（`ShanLe1224`）：product page 直接读 `public/data/v1/` 的静态图层，格式见 `docs/SHARED_INTERFACES.md` 2.5.1 和 `manifest.json`。**2026-11-15 核对：产品页现在没有任何一处引用这批数据**（它自己有另一套光照、温度、冰的模型图层），L4–L7 和地球可见图层都还没有（见 Q10）。
- [ ] 每个人：完成 TEAM_HANDBOOK 第 2 节的"热身提交"。
- [ ] `leeziqi0531-debug`：建立 CREDITS 登记习惯；起草 30 秒视频分镜。
- [x] **agent 频率限制**（2026-11-14 完成）：Vercel 防火墙规则 `agent-rate-limit-20-per-min`，`/api/agent` 每个 IP 每 60 秒最多 20 次，超出返回 429。已在线上实测（前 20 次通过，第 21 次起 429）。规则只存在于 Vercel 后台，参数和重建办法见 `docs/decisions/2026-11-14_xbl2602_agent-rate-limit.md`。**它限的是速度，不是总花费**：多个 IP 可以绕过，所以 DeepSeek 账号里仍建议只留少量余额。
- [ ] DeepSeek key（变量名 `DEEPSEEK_API_KEY`）：`xbl2602` 已在 Vercel 创建（AI 不碰密钥）。环境变量只对**之后的新部署**生效；验证办法：`POST /api/agent` 不再返回 503 `not_configured`。如果新部署后仍是 503，检查变量名拼写、是否勾选了 Production、值是否为空。
- [ ] 把 `AI_PLAYBOOK.md` 第 6 节"还没做、值得做的"（画质指标、固定机位 URL）转成产品里的调试工具。

## 已知限制（来自原型）

- 原型地球贴图是程序化的，不是真实 NASA 影像；岩石是程序化的；阿波罗 11 号 DTM 有一条南北向拼接缝未处理；东侧 1.2 km 外是合成地面（见 PROJECT_CONTEXT）。

## 整合后各人的下一步（2026-11-15 起，以整合后的 main 为新起点）

> 先做第 14.1 节的步骤，再按下面各自的清单走。对齐 main 的具体做法见 `docs/decisions/2026-11-15_xbl2602_integration-baseline.md`。下面不是命令，是核对 2026-11-15 的代码和接口后列出的缺口，优先级按 AGENTS.md 第 13 节。

- **`ShanLe1224`（产品页）**
  - [ ] 点位卡显示"这个点用的数据有多精细"（接口返回的 `terrain.resolutionM`：南极 160 m，其他约 7.6 km）。现在页面上完全没有，合并南极高精度后用户看不出差别。
  - [ ] 点位卡里的一年统计固定是 2030 年：要么把时间轴起点传给接口的 `statsStart`，要么卡片上写明"2030 年"。现在不传也不写明。
  - [ ] "按条件找位置"（`POST /api/find-sites`）和"跨日期对比"（`POST /api/compare-dates`）加页面入口：现在只有 AI 和 MCP 能用，页面没有入口。
  - [x] 着陆点列表改读 `/api/presets`（2026-11-15 由 xbl2602 代做，改了 `modes/` 下 3 个文件和 `lunar-quest-app.tsx`，**请夏娜看一眼**）。
  - [ ] 极区地图颜色和点位卡同源（等 Q7）；整月图层 L4–L7（等 Q10）。
  - [ ] 看一眼整合时替你合入的第一人称改动（chanjy0806 的 5 个提交，没有经过你审）。
- **`chanjy0806`（落地页 + 第一人称）**
  - [x] 第一人称在 9.00°N 67.91°E 的"墙"故障：chanjy0806 已修（根因见 chanjy0806 的 2026-11-15 日志），随第二轮合并进了 main。2026-11-15 最终合并时**没有重新在浏览器里复验**，评审前最好再点一次这个点。
  - 其余：落地页继续；第一人称撞击坑和调色已经合进 main。以后动 `src/ui/product/` 先和夏娜说，并在自己的新分支上做。
- **`louis068`（agent-search）**
  - [ ] 两套 AI 前端请求代码合并成一套：`src/features/agent-search/ui/search-client.ts`（有测试，但没有页面在用）和 `src/ui/product/panels/ai-chat/agent-client.ts`（页面在用，没有测试）。
  - [ ] `LunarSearch`（含"快捷问题"）现在没有页面挂载：保留还是删。
  - [ ] 旧分支 `louis068/docs-project-readme` 已被主线取代，**不要合并**（里面的地名表和提示词是旧版，合进来会倒退）；确认后可删。
  - [ ] 太阳能量工具已进 AI 白名单，抽查几个回答。
- **`leeziqi0531-debug`**：`pitch/` 目录还没有；30 秒视频分镜；视频里如实说明哪些是已有基础（D-0008）。
- **`xbl2602`**：Q6–Q10；GitHub 分支保护（#35 没有任何人审核就合了）；已合并的旧远端分支清理（要先确认再删）；#29 已被 #31 包含，关闭。
