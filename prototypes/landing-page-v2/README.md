# landing-page-v2 · 月球着陆点导航器示范页

这是一个**纯演示用的单页落地页**，用原生 HTML / CSS / JS + three.js 写成，不依赖任何前端框架。
目标是回答一个问题：怎么让人**一眼看懂**这个产品（月面任意点的光照与对地通信），
并且相信它**真的可以被程序调用**（REST + MCP）、**真的能多种方式部署**（Vercel / Docker / 本地）。

> 这是 `prototypes/` 里的实验品，**不是产品代码**。产品页在 `app/(landing)/`（负责人 chanjy0806）。
> 本目录与 `prototypes/lunar-scene-demo/` 相互独立，不改动它，只从它生成派生数据。

## 怎么跑

必须用一个静态服务器打开（ES module + `fetch` 不支持 `file://`）：

```bash
cd prototypes/landing-page-v2
python -m http.server 5200
```

然后浏览器打开 http://127.0.0.1:5200/

调试用参数：

- `?fast=1` 跳过打字/逐行播放，直接显示录播的最终状态（截图 QA 用）
- `?v=2` 之类的查询串用来绕过浏览器缓存

## 页面结构

| 幕 | 内容 | 用到的数据 / 技术 |
|---|---|---|
| 00 顶部导航 | 单行 HUD，滚动后加毛玻璃底 | 纯 CSS |
| 01 首屏 | three.js 月球 + 三条接口节点（WEB / REST API / MCP），真实太阳方位驱动明暗界线 | 程序化 ShaderMaterial + UnrealBloomPass |
| 02 问题 | 单点地平线**剖面**：从站点沿太阳方位射线步进真实 DEM，画出视线被山脊挡住 | `assets/horizon-basin.json` + 实时 DEM 采样 |
| 03 地图 | 可拖动时间轴（一年逐小时）、5 个图层、点击任意点出参数卡（高程 / 坡度 / 太阳与地球高度角 / 年日照 / 最长断电 / 最长断信号 / 地平线剖面） | three.js 正交相机 + 实时阴影 + 运行时射线步进 |
| 04 智能体 | 三个只读工具的对话演示，表格是真实 `compare_points` 返回值 | `data/recorded/compare.json` |
| 05 第一人称 | 阿波罗 11 号静海基地，LROC 2 m 高程，1.6 m 眼高，真实太阳高度 11.2° | `assets/terrain-apollo.bin` + 程序化石块 |
| 06 开放接口 | MCP 控制台逐行播放 `tools/list` 与 `tools/call`，右侧是 REST 与 MCP 客户端配置 | `data/recorded/mcp-*.json`（真实响应） |
| 07 部署 | Vercel / Docker / 本地三种跑法，命令可复制 | 文案 + 复制按钮 |

## 哪些是真的，哪些是录播

**页面里能点的、能拖的，全部是当场计算的：**

- 地形高程：`terrain.bin` 是从 `prototypes/lunar-scene-demo/data/derived/dem_crop.i16`（NASA LOLA 10 m/px，4200×4200）
  面积平均降采样到 640×640 的**真实高程**，不是随机噪声。
- 时间轴：`data/recorded/skyyear.json` 是原型里逐小时算好的 8760 组太阳/地球方位角与高度角。
  页面按滑块索引取用，并做了经度修正（见下）。
- 点击地图时的高程、坡度、地平线剖面、年日照比例、最长断电/断信号，都是**当场**由 DEM + 星历算出来的，
  不是查表，更不是写死的数字。
- 首屏月球的明暗界线由真实太阳方位角驱动（程序化表面，仅作视觉，不代表真实月面纹理）。

**录播的只有两处：**

- 第 04 幕智能体对话：消息的**文本与节奏**是编排的，但表格里的数值来自真实 `POST /api/compare` 响应。
- 第 06 幕 MCP 控制台：逐行播放的内容是真实 `POST /mcp` 响应（`tools/list` 与 `tools/call`），
  只是把动画放给你看，页面不会联网调用线上接口。

`data/recorded/` 里保存了抓取时的原始响应，可以对照：

| 文件 | 来源 |
|---|---|
| `health.json` `point.json` `compare.json` `presets.json` | 本地 `npm run dev` 的 REST 接口 |
| `mcp-initialize.json` `mcp-tools-list.json` `mcp-call-point.json` `mcp-call-presets.json` | 本地 `POST /mcp` |
| `skyyear.json` | `prototypes/lunar-scene-demo/data/derived/sky_year.json` |

## 数据来源与近似（重要）

- 地形：NASA LOLA 10 m/px（南极，42 km × 42 km）、LROC NAC DTM APOLLO11 v1.9 2 m/px（静海基地，裁剪 4.2 km）。
  详细生成方法见 `assets/ASSETS.md`。
- 星历：`sky_year.json` 是在**极点（经度 0）**采样的，而示范点在南极 A（89.71°S, 62.5°E）。
  页面把方位角统一减 62.5° 做近似修正，已用 `/api/point` 在 4 个时刻对拍，误差 < 0.05°。
- 高度角修正只做了一阶：`(u·r)/R`。射线剖面里加了月球曲率 `d²/2R`。
- 阿波罗 11 号那一幕的太阳/地球角度取自 `/api/point` 在 `2026-11-16T00:00:00Z` 的真实返回值，
  那一幕不跟时间轴联动。
- 星历精度约 0.02°，适合可视化，不适合任务级规划（和产品 `docs/SHARED_INTERFACES.md` 的口径一致）。

## 技术说明

- 不用框架、不用构建步骤。three.js r187 从 `prototypes/lunar-scene-demo/node_modules/three` **复制到本地**
  `vendor/`，所以断网也能跑；没有用 CDN。
- 后处理只用了 `EffectComposer + RenderPass + UnrealBloomPass + OutputPass`，全部在 `vendor/postprocessing/`。
- 三个 WebGL 视图都会在离开视口后暂停；地图视图只在图层/时间变化时重绘。
- 尊重 `prefers-reduced-motion`：动效全部降级，3D 只渲染一帧。
- 移动端：首屏 3D 降级，地图与侧栏改为上下堆叠，第一人称改为非 sticky。

## 截图与 QA

`tools/shot.mjs` 是一个不依赖 puppeteer 的无头 Chrome 截图脚本（CDP）：

```bash
# 先用 9223 端口起一个 headless Chrome
"C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --disable-gpu ^
  --enable-unsafe-swiftshader --remote-debugging-port=9223 ^
  --disable-background-timer-throttling --user-data-dir=%TEMP%\cdp-profile2 about:blank

node tools/shot.mjs "http://127.0.0.1:5200/?fast=1" "shots/x.png" 8000 1600 1000 2000
# 参数：url 输出 等待毫秒 宽 高 滚动位置 [点击x 点击y]
```

`tools/eval.mjs` 用来在页面里执行一段表达式（调试布局与数据用）。

## 还没做的

- 地图只覆盖南极这一块 42 km 的示范区域，不是整个月面。
- 图层里的「年日照比例 / 年地球可见」用的是预计算好的 128×128 结果（见 `assets/ASSETS.md`），
  不是实时重算。
- 没有接真实的 `/api` 与 `/mcp`：页面是静态文件，线上接口还开着 Vercel 登录保护，跨域也需要额外配置。
