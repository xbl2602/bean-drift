# 产品页第一版：Lunar Quest（2D 默认 + 3D 阴影 + 点击进第一人称），以及几处越过我目录的改动

- **日期**：2026-11-14
- **提出人**：ShanLe1224（Claude Code 协助编写）
- **状态**：提议
- **需要谁确认**：xbl2602

## 背景
product page 之前只是占位页。这次做了第一版：全屏月球地图（默认 2D 展开图，可切 3D 球），左上角"Lunar Quest"工具按钮（教程、图层），点击地图任意点直接进入该点第一人称视角。代码都在我的目录里（`app/(product)/`、`src/ui/product/`、`public/product/`），但有几处需要 xbl2602 拍板。

## 决定（待确认）
1. **对外名称用 "Lunar Quest"**（产品页标题和左上角按钮）。仓库/包名仍是 bean-drift。landing page 上的名字由 chanjy0806 决定是否跟着改。
2. **`package.json` 新增依赖 `three@^0.181.2`、开发依赖 `@types/three`**（package.json 归 xbl2602）。three.js 本来就是 D-0001 定下的渲染库。
3. **前端直接 import `src/core`**：`@/core/data` 的 `getPointConditions`（第一人称面板的太阳/地球数值）和 `@/core/ephemeris/ephemeris` 的 `skyAtLatLon`（求某时刻太阳在月固系的方向，给 2D/3D 打光）。没有自己写星历，只做坐标变换（`src/ui/product/moon-frames.ts`）。理由：光照要随时间滑块实时变化，每帧打 `/api/point` 不现实。如果希望前端只走 `src/core/data`，请在那里导出一个"太阳方向（月固系）"的函数，我改过去。
4. **底图和地形数据选用 NASA SVS CGI Moon Kit**（而不是 TODO Q5 里候选的 Moon Trek 瓦片，后者使用条款未确认）。SVS 明确要求的只是署名。已登记 CREDITS。
5. **静态贴图进 git，共约 43 MB**（`public/product/moon/`：彩图 8K 4.1 MB、4K 1.2 MB，relief/normal/slope 约 11 MB，16 位高度切片 648 块共 30 MB）。单个文件都远小于 50 MB。原始 TIF 不进 git，生成脚本在 `src/ui/product/data-build/`。
6. **本机 Node 用的是 26 LTS**（winget 没有 24），`npm install` 有 engine 警告，`npm run build` 和 `tsc` 都通过。

## 原因
- 评委只看前端，2D/3D/第一人称是 AGENTS.md 第 13 节"绝对不能砍"的核心。
- 4K 显示：2D 用 8K 彩图（显卡不支持 8192 贴图时退回 4K），3D 用 4K 彩图 + 4K 法线 + 4K 高度位移，渲染分辨率按设备像素比（最高 2 倍）。
- 阴影：3D 和第一人称都用真实时刻的太阳方向 + three.js 阴影贴图，地形本身投影（3D 起伏放大 4 倍才看得到，界面上已注明）。2D 的"Sunlight & shadow"图层是昼夜线 + 坡面明暗，**没有**计算地形投影（那需要地平线数据，等 pipeline）。

## 已知限制（如实说明）
- 第一人称地形是全月 LOLA 1/16°（约 1.9 km/像素），站在 1.6 m 眼高时近处是平滑的，看不到小石头和小坑；升高到 1–10 km 才看得出山和坑的阴影。要做真正的"宇航员视角"，需要像原型那样接入局部高分辨率 DEM（10 m / 2 m）。
- 面板里的太阳/地球高度角来自 core，是相对光滑球面的，不含地形遮挡（和 SHARED_INTERFACES 一致）。
- 星空是装饰（固定随机种子），不是真实星表。

## 备选方案
- Moon Trek WMTS 瓦片：分辨率更高，但使用条款未确认，而且要做瓦片加载器，48 小时内风险大。
- 3D 用 Cesium / 地球引擎：和 D-0001 选的 three.js 冲突，体积大。

## 影响
- 我的目录：`app/(product)/product/page.tsx`、`src/ui/product/**`、`public/product/moon/**`。
- 越界：`package.json`、`package-lock.json`（新增 three）、`docs/CREDITS.md`（追加两行，规则允许）。
- landing page（chanjy0806）：现有 "Open the map" 按钮已经指向 `/product`，不用改；要改按钮文字或品牌名请 chanjy0806 自己改。

---

## 追加（同日，第二版）：时间轴、12 个工具、模型图层

操作者（ShanLe1224）要求的第二轮功能，同样等 xbl2602 确认。

### 做了什么
- **底部时间轴**（2D、3D、第一人称都有）：拖动或播放，太阳按星历走，3D 和第一人称的阴影跟着变。
- **左上角工具改为 12 项**：Tutorial、Search Location、Select Landing Site、Measure Distance、Terrain & Elevation、Solar Illumination、Temperature、Water Ice Potential、Surface Slope、Site Suitability、Compare Locations、Export Results。
- **第一人称**：近处加密的极坐标地形网格、阴影贴图随视点高度收紧、360° 罗盘、可选 4K 渲染缓冲。

### 需要 xbl2602 拍板的点
1. **前端自己写了一套"模型"公式**（`src/ui/product/analysis/analysis-model.ts`，着色器版在 `analysis-glsl.ts`）：温度（瞬时辐射平衡）、水冰潜力指数、光照比例、选址评分。按 AGENTS.md 5.1 这类逻辑本应在 `src/features/<功能>/logic/`，由 API/MCP 共用。现在放在前端是因为要在着色器里逐像素算。**建议**：公式定下来后（TODO Q1/Q2）搬到 features，前端只留着色器版。
2. **极区永久阴影是我在本机算的衍生数据**（`build-polar-light.mjs`，约 2 分钟）。按 D-0006 重计算归 xbl2602 的 pipeline。它只有 1.9 km 分辨率、太阳方位用了极区平面近似；等 pipeline 有正式地平线数据后应替换。
3. **选址评分的标准和默认权重是我定的**（坡度 1.0、光照 0.8、对地可见 0.6、水冰可达 0.6、热环境 0；坡度 15°–25° 一票否决）。这正是 TODO Q2 还没拍板的内容，现在的值只是占位。
4. **新数据源**：IAU/USGS 月面地名表（已登记 CREDITS；下载页没有写使用条款）。
5. **第一人称近处的小坑、起伏、月壤颗粒是程序生成的示意细节**，不是数据（`terrain-detail.ts`）。界面上写了 "illustrative, not measured"。视频里如果用到这个画面，要按比赛规则说明。
6. 候选点存在浏览器 localStorage，不进数据库。对比用的太阳/地球角度直接调 `src/core`，没有走 `/api/compare`。
7. `public/product/` 现在约 49 MB。

### 界面上怎么标注的
每个图层面板都有一段说明：实测（LOLA 高度、坡度）、星历（太阳/地球角度）、模型（其余）。对比表和导出文件里每个指标也带这个标签。
