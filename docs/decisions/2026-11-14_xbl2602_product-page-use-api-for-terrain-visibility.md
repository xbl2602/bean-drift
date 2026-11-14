# 产品页的浏览器代码不再直接引用 core 的数据入口；地形遮挡后的可见性改走 /api/point

- **提出人**：`xbl2602`（改动由 xbl2602 的 AI 助手在 `ShanLe1224` 的目录里完成，xbl2602 当场同意，见"越界说明"）
- **状态**：采纳（已实现并验证；等 `ShanLe1224` 合并进他的分支）

## 决定了什么

1. **产品页的浏览器端代码不得 import `@/core/data`。** 这个入口现在会读服务器上的预计算文件（`node:fs`），浏览器打包不了。要用到它的量，一律向本站的 `/api/point` 取。
2. **逐帧要用的太阳/地球方向，继续在浏览器里算**，直接用 `src/core/ephemeris` 里那个纯计算函数（和 `/api/point` 里的 `sun` / `earth` 是同一个函数的输出，只差四舍五入）。拖时间轴时每一帧都等网络不可能。封装在 `src/ui/product/sky-conditions.ts`。
3. **第一人称面板新增 "Terrain-adjusted" 一块**：地形遮挡后太阳、地球圆盘露出的比例、下次升起/落下时刻、一年里可见比例和最长断电、两者同时可见的占比。数据来自 `/api/point`，和 API、MCP、AI 窗口同一份。代码在 `src/ui/product/point-api/`。
4. 请求行为：点变了立刻请求；拖时间轴停下 450 ms 后才请求一次；上一个没回来就取消；请求期间显示上一次的数据并标"updating…"；失败时给用户看得懂的提示（不透传服务器原文），第一人称画面照常工作；空值显示 "—"，不当成 0。

## 为什么

- **不改不行**：`ShanLe1224/product-lunar-quest-map` 是在旧主线（核心还是纯计算）上写的。合并最新主线后，类型检查通过，但 Turbopack 生产构建失败：`/product` 页 "the chunking context does not support external modules (request: node:fs)"。Vercel 用的是同一种构建，所以不改就部署不上。我在临时目录里实际合并构建验证过，改完后同样的构建通过。
- **顺便补上缺口**：他的面板文字自己写着"太阳和地球角度不含地形遮挡"，而这正是后端已经算出来的东西。

## 没变的（仍是待拍板的事）

- 产品页自己的"模型"（`src/ui/product/analysis/`：温度、水冰潜力、光照比例、选址评分）、他在本机算的极区永久阴影图、选址评分的默认权重：原样保留，仍等 xbl2602 在他的决定文件 `2026-11-14_ShanLe1224_lunar-quest-product-page.md` 里列的那几条上拍板。
- 画面和阴影继续用他的 LOLA 1/16°（约 1.9 km/像素）数据：比整月预计算地图（0.25°，约 7.6 km/格）细，换成后者会变糊。接口的价值在统计数字，不在画面。
- "Select Landing Site"/"Compare" 面板还没改接 `find_sites` / `compare_dates`（可选的下一步）。

## 越界说明

按 AGENTS.md 第 2 节，`src/ui/product/` 归 `ShanLe1224`。这次由 xbl2602 明确要求"我们这边直接做"。为了不覆盖他正在改的东西：改动放在新分支 `xbl2602/product-api-switch`（从他的分支拉出，已合并最新主线），PR 的目标是他的分支，由他合并；没有直接推他的分支。改动范围只有：新增 `src/ui/product/sky-conditions.ts`、`src/ui/product/point-api/`，改 `first-person-view.tsx`、`first-person-scene.ts`、`analysis/point-analysis.ts` 各几行；以及合并主线时解决 `docs/CREDITS.md` 的追加冲突（两边的行都保留）。

## 影响

- 合并后产品页能在 Vercel 上构建。
- 一年统计目前只覆盖 2030 年；时间轴拖到别的年份时，面板里写明"Yearly figures cover 2030 only"。
- 点一个点会多一次网络请求（本机约零点几秒，Vercel 冷启动偶尔更慢）。

## 顺带发现（不是这次引入的，转给 ShanLe1224）

- 产品页打开约 160 ms 就有 React 报错 #418（水合文本不一致）：`lunar-quest-app.tsx` 用 `useState(() => Date.now())` 做初始时间，服务器渲染的"Now …"和浏览器渲染的不同。
- 没有 favicon（`/favicon.ico` 返回 404）。
