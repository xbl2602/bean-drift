# 决策记录（DECISION_LOG）

> **记录"当时为什么这么定"**，这样几周后不用重新争论，也能知道哪些是临时的。
> 维护人：`xbl2602`。**其他人不要直接改本文件**：新决定写成 `docs/decisions/YYYY-MM-DD_<用户名>_<主题>.md`（模板见 [decisions/_TEMPLATE.md](decisions/_TEMPLATE.md)），由 `xbl2602` 定期整理进来。这样 5 个人同时写也不会互相冲突。
> 状态：`采纳` 已定 · `暂定` 先按这个走、待验证 · `待决` 还没定（见 [TODO.md](TODO.md)）。

---

## D-0001 产品用 Next.js + Tailwind + three.js（`采纳`）

- **决定**：产品站点用 Next.js（App Router）+ Tailwind；三维/地图渲染用 three.js；现有静态原型仅作参考。
- **原因**：产品要同时提供网页、API、MCP，还要放数据库和密钥、一次 `git push` 就能部署到 Vercel。静态 HTML 原型做不到这些；Next.js 能让这些都在同一个项目里。three.js 场景可以作为组件嵌进 product page。
- **备选**：继续用静态页面加独立后端（要多维护一套部署，不选）。
- **谁定的**：`xbl2602` 授权 AI 代为选择（"相信你"）；地基已按 Next.js 16 落地，视为确认（见 D-0014）。

## D-0002 部署目标 Vercel + Supabase（`采纳`）

- 目标是 Vercel + Supabase。代码不得依赖 Vercel 专属特性，保证 Docker、本地安装也能跑。

## D-0003 沿用 averis 项目的"模块隔离"架构规则（`采纳`）

- **决定**：每个功能自包含，内部分 `logic / api / mcp / ui`；核心只放最小骨架；一个目录一个负责人。
- **原因**：5 人、每人还可能同时开多个 agent，必须在物理上降低互相冲突的概率，并让代码在多人开发下保持可控、可维护。**这是底层代码规则，不是为了炫技，也不能拖慢视觉体验这条第一优先级。**
- **来源**：averis hackathon 项目的 AGENTS.md（做了裁剪，去掉了和本项目无关的部分）。

## D-0004 MCP 用 HTTP/SSE，不用 stdio（`暂定`）

- 同一个部署地址同时服务网页、API、MCP，不需要用户在本机另起进程。`xbl2602` 表示不熟悉这个区别、交给 AI 选择；沿用 averis 的做法。

## D-0005 agent 窗口只接 DeepSeek，且仅限拥有者配置（`采纳`）

- **决定**：agent 窗口的 LLM 只支持 DeepSeek API；key 由 `xbl2602` 在服务端配置，**不对用户开放**。key 一律只放 Vercel 环境变量，不进仓库、不进前端（AGENTS.md 第 4 节）。
- **原因**：不需要多家 LLM 切换，复杂度和泄露面都更小。公开站点每次调用花拥有者的钱，所以必须限频限长且只开只读白名单工具。

## D-0006 重计算放 xbl2602 个人电脑，VPS 只作辅助（`采纳`）

- 现有 VPS 是 2 核 ARM、12 GB、无 GPU，性能不足；预计算在个人电脑上做，产物是静态文件。VPS 可用于托管静态文件或辅助任务，但演示用数据不能只依赖它（宕机风险）。

## D-0007 目标：整个月面每一点都有数据可调用（`采纳`目标，方案`待决`）

- **目标**：覆盖全月，任何经纬度都能取到参数。
- **候选方案**：分层——预计算静态图块 + 预计算地平线图（让时间轴实时算光照）+ 点击时按需精算。**耗时与可行性未验证**，要先实测。详见 FEATURE_SPEC 第 6 节。

## D-0008 沿用此前演练仓库的框架与原型，不从零重写（`采纳`，风险`待确认`）

- **决定**：本仓库直接沿用此前演练仓库里的规则（`AGENTS.md`）、文档体系、`src/core` 与示例功能（API/MCP 骨架）和 `prototypes/`，不再从零重写。迁入时没有带 git 历史、个人日志、会议原始记录，也去掉了带日期的状态信息。
- **背景**：最初的计划是演练仓库只用来熟悉流程、现场从零重做、代码不搬过去；后来决定直接沿用。
- **风险（未解决）**：官方 FAQ 有一条"赛前不得开始做挑战"（原文见 `docs/research/lunar-landing-site-navigator_research.md` 第 1 节）；沿用的内容是活动开始之前做的。演练期间的工作算不算"开始做挑战"、沿用是否需要向组织者说明，**没有向组织者确认过**，见 TODO Q6。
- **对外说明**：这些是已有基础，不是现场新写的。视频和提交文档里如实标注哪些是已有基础，不要写成全部现场从零完成。

## D-0009 优先级：视觉冲击力与核心地图体验第一（`采纳`）

- 前端做不好，后端再好也没用。顺序：视觉与核心地图 → API/MCP → 多种部署方式 → （简易版不做）。架构规则服务于"多人并发下可维护"，不得拖慢第一条。

## D-0010 只做完整版，不做简易版（`采纳`）

- 时间有限，把一个版本打磨好。简易版是后续设想。

## D-0011 文档语言：中文；界面与视频文案：英文（`暂定`）

- 团队以中文沟通；评委在吉隆坡、视频限 30 秒，面向评委的内容用英文。（`xbl2602` 未明确反对，按默认执行。）

## D-0012 AGENTS.md 是唯一规则文件，CLAUDE.md 只引入它（`采纳`）

- `CLAUDE.md` 内容只有 `@AGENTS.md`。**取消** averis 项目里"两个文件逐字同步"的规则：因为只有一份内容，不会漂移，OpenCode、Codex 等工具直接读 AGENTS.md。

## D-0013 多人多 agent 的隔离约定（`采纳`）

- 一个目录一个负责人；每个 agent 一个分支加独立 worktree；共享记录"一条一个文件"（`docs/decisions/`、`docs/logs/<用户名>/`）；只用 `git add <具体路径>`；命名按功能不按人。详见 AGENTS.md 第 2 节。

## D-0014 地基选型：Next.js 骨架、REST API、手写 MCP（`采纳`）

- **产品名** Bean Drift，npm 包名 `bean-drift`。
- **技术栈落地**：Next.js 16（App Router）+ React 19 + Tailwind 4 + TypeScript 5 + zod 4，npm。
- **统一数据接口先接真实星历**：原型 `ephemeris.js`（已对照 JPL Horizons）移植为 `src/core/ephemeris/ephemeris.ts`，作为全项目唯一的星历实现。地形（LOLA）和一年统计**没有接入，接口恒返回 `null` 并带说明**，不编造数据。
- **MCP 手写最小实现**（`src/core/mcp/server.ts`：initialize / ping / tools/list / tools/call，Streamable HTTP，无状态），不引入 MCP SDK。工具类型强制 `access: "read"`。
- **Supabase 暂不接入**：目前没有需要持久化的东西。`.env.example` 里保留变量名并标注"暂不使用"。
- **不做 `/api/agent`**：agent 窗口需要真实的限流，而 AGENTS.md 禁止模块级可变状态，限流必须用共享存储（Supabase）或 Vercel 防火墙规则。等要做 agent 时再定，现在不放一个空接口。
- **预设点位只放 4 个有出处的**（南极、南极 A/B 平缓地带、阿波罗 11 号，来自原型），其余等 TODO Q3。
- **时间范围限制 2000–2100**：截断星历理论在这个范围内可靠。
- **原因**：先让网页、API、MCP 三条通路都用同一份 `logic/` 跑通，别人接手时照着抄就行，不会各写各的口径；手写 MCP 的协议子集很小，少一个依赖，也避免 SDK 默认带会话状态（Vercel 多实例下会出问题）；如实返回 `null` 是因为不把没验证的写成完成。
- **备选**：用 `mcp-handler` / 官方 MCP SDK（功能更全，但引入依赖和会话状态问题，以后需要流式、采样时再换）；现在就接 Supabase（没有数据要存，只会多一套要保管的密钥）。
- **后续更新（2026-11-15 整理）**：上面几条当时是对的，现在已变：`/api/agent` 已做（D-0019）；预设点位已补到 24 个（TODO Q3）；地形和一年统计已接入真实数据（D-0017、D-0028）。

## D-0015 用本机身份文件 `IDENTITY.md` 告诉 agent"操作者是谁"（`采纳`）

- **决定**：AGENTS.md 是 5 个人共用的一份规则，agent 要靠 `IDENTITY.md`（GitHub 用户名、角色、负责的目录）才知道该套用归属表里的哪一行。`IDENTITY.md` 是本机文件，已写进 `.gitignore`，**不提交、不公开**；模板 `IDENTITY.example.md` 会提交。
- **原因**：不靠 agent 猜操作者是谁，也不把每个人的本机信息混进仓库；"只改自己负责的目录"这条核心规则才能被 agent 真正执行。
- **约束**：`IDENTITY.md` 里不写密钥、密码、邮箱、手机号、真实姓名。

---

> 以下 D-0016 起是 2026-11-15 整合时从 `docs/decisions/` 里整理进来的（当时积压了 16 条没整理）。每条只写结论，原因和细节看链接里的原文件。

## D-0016 点位参数接口：先留槽位，数据后接入（`采纳`）

- 每组参数永远存在，没有数据时字段为 `null`，是否有数据看 `provenance.<组>.status`。见 [decisions/2026-11-14_xbl2602_point-conditions-slots.md](decisions/2026-11-14_xbl2602_point-conditions-slots.md)。

## D-0017 整月地形遮挡与一年统计：口径定了，数据随网站发布（`采纳`）

- 解决 TODO Q1：L6 按次平均、"可见"= 圆盘上缘高于地形地平线、统计期默认 2030 全年逐小时。整月 0.25° 预计算（约 55 MB）放 `public/data/v1/`，不需要外部存储。见 [decisions/2026-11-14_xbl2602_precomputed-terrain-and-year-stats.md](decisions/2026-11-14_xbl2602_precomputed-terrain-and-year-stats.md)。

## D-0018 新增三个查询工具、"同时可见"统计、地球最低仰角（选填）（`采纳`）

- `get_point_timeline`、`compare_dates`、`find_sites` 三个工具，加上同时可见比例和选填的地球最低仰角（不设默认值，因为没有官方来源）。见 [decisions/2026-11-14_xbl2602_new-query-tools-and-min-earth-elevation.md](decisions/2026-11-14_xbl2602_new-query-tools-and-min-earth-elevation.md)。

## D-0019 agent 窗口：路由接线，每个 IP 每分钟最多 20 次（`采纳`）

- **更新 D-0014 的"不做 `/api/agent`"**：路由已接线；频率限制用 Vercel 防火墙规则做（不是代码里限流）。louis068 最初的提议见 [decisions/2026-11-14_louis068_agent-search-contract.md](decisions/2026-11-14_louis068_agent-search-contract.md)。
- 见 [decisions/2026-11-14_xbl2602_agent-route-wiring.md](decisions/2026-11-14_xbl2602_agent-route-wiring.md)、[decisions/2026-11-14_xbl2602_agent-rate-limit.md](decisions/2026-11-14_xbl2602_agent-rate-limit.md)。

## D-0020 agent 接上三个新工具，`compare_points` 在 agent 里最多 6 点（`采纳`）

- 原因是 agent 单个工具结果上限 65,536 字节；超限时改为把 `result_too_large` 交给模型而不是整个回答失败。输出上限后来提到 2400 tokens，见 SHARED_INTERFACES 第 6 节。见 [decisions/2026-11-14_xbl2602_agent-new-tools-and-compare-cap.md](decisions/2026-11-14_xbl2602_agent-new-tools-and-compare-cap.md)。

## D-0021 接受产品页第一版（Lunar Quest）并合并进 main（`采纳`）

- 2D 默认 + 3D 阴影 + 点击进第一人称。见 [decisions/2026-11-14_ShanLe1224_lunar-quest-product-page.md](decisions/2026-11-14_ShanLe1224_lunar-quest-product-page.md)、[decisions/2026-11-14_xbl2602_accept-product-page-and-merge-to-main.md](decisions/2026-11-14_xbl2602_accept-product-page-and-merge-to-main.md)。

## D-0022 产品页加载提速：首页空闲时提前下载贴图（`采纳`，贴图部分已被 D-0029 取代）

- 当时是把底图 16K 改 8K。现在改成 4K 底图加瓦片，预下载也改成分三批，见 D-0029。见 [decisions/2026-11-14_xbl2602_product-page-load-speed.md](decisions/2026-11-14_xbl2602_product-page-load-speed.md)。

## D-0023 产品页浏览器代码不再直接引用 core 的数据入口（`采纳`）

- 地形遮挡后的可见性改走 `/api/point`。**例外（已写在原文里，不算违规）**：逐帧要用的太阳/地球方向在浏览器里直接用 `src/core/ephemeris` 里同一个纯函数算（和接口里的 `sun`/`earth` 是同一份代码），不然拖时间轴每帧都要等网络。见 [decisions/2026-11-14_xbl2602_product-page-use-api-for-terrain-visibility.md](decisions/2026-11-14_xbl2602_product-page-use-api-for-terrain-visibility.md)。

## D-0024 产品页分成三个模式（Landing Sites / Explore / Find Data），默认 3D（`暂定`）

- 已合并进 main。**其中"着陆点用 IAU 官方 Statio 名、前端自己写 6 个点"等 xbl2602 明确确认**，见 TODO Q8。见 [decisions/2026-11-15_ShanLe1224_product-three-modes.md](decisions/2026-11-15_ShanLe1224_product-three-modes.md)。

## D-0025 放大后接 NASA Moon Trek 瓦片看近景（`已实现`）

- 2D 和 3D 都在放大到全球底图不够清楚时叠加 Moon Trek 的 LRO WAC 瓦片，仅用于显示。见 [decisions/2026-11-14_ShanLe1224_close-up-lunar-imagery.md](decisions/2026-11-14_ShanLe1224_close-up-lunar-imagery.md)。

## D-0026 AI 回答：附近地名示意图和 IAU 地名来源（`已实现`）

- 服务端用 IAU 地名表查坐标附近的地名，作为 `lunar_gazetteer` 来源（不是模型能调用的工具，不算"已计算"）。见 [decisions/2026-11-15_louis068_agent-nearby-map.md](decisions/2026-11-15_louis068_agent-nearby-map.md)。

## D-0027 AI 回答画图：地平线、天体高度、年占比条（`已实现`）

- 只在 agent-search 内，不改共用接口。见 [decisions/2026-11-15_louis068_agent-visual-answers.md](decisions/2026-11-15_louis068_agent-visual-answers.md)。

## D-0028 南极（80°S 到极点）160 m 高精度数据（`采纳`，已实现并测试）

- 点查询用 40 m 原始数据平均成 160 m，地平线 90 个方位现算（不存），不用外部储存（共 17.4 MB）；按位置在"南极 160 m / 全月 0.25°"之间选数据，返回里写明用了哪份。整月地图和 `find_sites` 仍是 0.25°；年份扫描（2035、2043）只是提议，没确认。同时新增太阳能量估算 `GET /api/energy` 和 MCP `get_solar_energy_estimate`。见 [decisions/2026-11-15_xbl2602_polar-highres-data-and-routing.md](decisions/2026-11-15_xbl2602_polar-highres-data-and-routing.md)。

## D-0029 产品页只渲染"此刻需要的"（`采纳`，已实现并验证）

- 画布按屏幕像素；画面没变不重画；贴图金字塔（4K 底图 + 8K/16K 瓦片按需）；阴影图只盖看得见的范围；3D 球切块；遮罩只等当前要看的。追加：瓦片图集常驻显存，放大缩小不再卡顿。见 [decisions/2026-11-15_xbl2602_product-on-demand-rendering.md](decisions/2026-11-15_xbl2602_product-on-demand-rendering.md)。

## D-0030 以整合后的 main 作为全员新起点（`采纳`）

- 2026-11-15 把还没进主线的分支合进 main，修了文档矛盾，所有人以后从这个 main 开新分支。做了什么、没合什么、怎么对齐，见 [decisions/2026-11-15_xbl2602_integration-baseline.md](decisions/2026-11-15_xbl2602_integration-baseline.md)。
