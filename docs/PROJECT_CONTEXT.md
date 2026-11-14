# NASA Space Apps — 项目上下文（给 AI agent 读，避免重复补充）

> 此文件记录**背景、赛题理解和技术调研**，是团队与 AI 之间的事实来源之一。
> 协作规则、分工、目录规范以仓库根目录的 [AGENTS.md](../AGENTS.md) 为准；功能范围见 [FEATURE_SPEC.md](FEATURE_SPEC.md)；已做出的决定见 [DECISION_LOG.md](DECISION_LOG.md)。
> **本文件里没有写过的内容不等于不存在，写过的内容也可能已被后来的决定改掉**——和 `docs/meetings/` 里的会议记录、`docs/DECISION_LOG.md` 交叉对照，没有固定的优先顺序。

## 1. 赛事基本信息
- 比赛：NASA Space Apps Challenge（吉隆坡站），48 小时；具体日程以官方最新公告为准。
- 选定赛题：**Lunar Landing Site Navigator**（编号 10 - CLPS，难度 Intermediate/Advanced）。
- **关于"赛前不要开工"**：官方 FAQ 有一条"赛前不得开始做挑战"（原文和出处见 [research/lunar-landing-site-navigator_research.md](research/lunar-landing-site-navigator_research.md) 第 1 节；没有再对照官网核实过）。本仓库沿用的框架与原型是活动开始之前做的，是否需要向本地组织者确认或说明，见 DECISION_LOG D-0008 和 TODO Q6。
  - 往届参赛条款：为赛事创作的原创内容须开源或自由授权；方案必须直接回应赛题。本届条款需自己再核对。
  - 吉隆坡说明会（见 docs/meetings/）强调的规则：不能用有版权的素材；AI 生成内容可以用但必须标明；用 NASA 数据有加分，要在视频里说明。这些已写进 AGENTS.md 和 docs/CREDITS.md。

## 2. 赛题要点（摘要）
任务：做一个直观的工具，让任务规划者、教育者、公众能**快速比较月球着陆点和日期**，可视化着陆点处**太阳和地球相对地平线的位置**，评估**发电潜力**和**对地直连通信窗口**。

背景：月球南极光照和地球可见性变化极端，地形（陡坡、深坑）会产生极端阴影。现有工具（Quickmap、Moon Trek、JPL Horizons）专业但难用。

赛题列出的可选方向（"可以考虑"，非强制）：
- 站点选择与对比：预设站点（阿波罗、CLPS 目标、其他国家）+ 自定义经纬度；并排或依次对比。
- 日期时间可调；可探索不同月昼、季节。
- 太阳/地球位置可视化；显示距日落、地球落下还剩多久。
- 指标：太阳高度角、日照时长、地球可见窗口。
- 多种可视化：2D 地图、3D 地表、其他创意形式。
- 时间动画或时间线（一个月昼内的变化）。
- 面向不同水平用户（规划者 / 教育者 / 公众）。
- 数据：星历可用 JPL Horizons 或预计算；地形用 LOLA；月球无大气，没有大气折射，地平线由地形和月球球体边缘决定；可考虑天平动（libration）。

**团队的优先级（用户明确纠正过）**：**前端是唯一被评委看到的东西，视觉冲击力是第一优先级。** 团队的重点是选对前端技术栈，做到"地形细节高清、太空一切都高清"。后端只是为前端供数据。
（我最初把重点放在后端计算上，被纠正。以后讨论优先从"画面能做到多好"出发。）

## 3. 团队
- 5 人：2 后端、3 前端（landing page、product page、pitch 视频兼打杂）。具体到人见 [TEAM_HANDBOOK.md](TEAM_HANDBOOK.md)（以那里为准）。
- 只有 1 人（xbl2602）有 AI agent 使用经验，其余 4 人此前没接触过 AI agent 甚至 GitHub，所以所有流程文档要按新手写。
- 比赛 48 小时，要让每个人明确分工和现场操作流程。
- **没有人有专业渲染工具经验；不手工建模，全部让 AI 生成**。接受 MCP 之类让 AI agent 操作软件的方式。
- 会用 Blender（做模型和烘焙），但由 AI 驱动。
- 可以注册第三方账号（如 Cesium ion）。

## 4. 部署与环境
- 交付形式：**纯网页，评委点链接就能看**。
- 以前用：Vercel + Supabase。
- 现有一台 VPS：2 核 ARM、12GB RAM（**无 GPU**）。
- 本机：Windows 11；本会话已连接 Vercel、Supabase、Figma 等工具。

## 5. 技术方案（当前推荐，待团队确认）

### 5.1 渲染（前端）——重点
**实测更新（prototypes/lunar-scene-demo/ 目录）：** 用同一套程序化几何和贴图（月坑地形、星空 + 银河、地球 + 云 + 大气辉光）在 three.js r187、Babylon.js 9.33.1、PlayCanvas 2.23.3 上各做一版（均为 WebGL2），打开 `prototypes/lunar-scene-demo/index.html` 对比。结论：同样内容下三者画面上限接近，差距主要来自光照、曝光和后期调参，而不是引擎本身；three.js 单帧最快（约 3–7 ms，RTX 5060 笔记本，1277×1147，非严格基准）、泛光最好看，Babylon 开箱后期最完整但要处理面朝向，PlayCanvas 画面也好但踩了三个隐蔽坑（渲染组件会覆盖网格的阴影标志，导致全场黑；法线贴图要切线；首帧空白）。three.js 开箱简陋，是因为 HDR、色调映射、泛光、级联阴影、多重采样、暗角这些要自己装；`prototypes/lunar-scene-demo/scene-three.js`（约 140 行）已经装好，可直接作起点。Babylon 作为备选（有 Inspector 调试面板）。

**画质第二轮（只在 three.js 上，`prototypes/lunar-scene-demo/scene-three.js`）：** 效果提升最大的几项，按贡献排序：
1. **实例化岩石和卵石**（2400 块岩石 + 7000 块卵石，棱角带平滑法线，参与级联阴影）——近景尺度感和真实感提升最大，帧耗时几乎不变（约 6 ms）。
2. **月壤专用光照**（Lommel-Seeliger 类，与 Lambert 以 0.55 混合）——坡面不再因背光变黑，更像月面的"粉质"观感。用 `?ls=0` 可对照。
3. **补光**：半球光模拟月面反弹，阴影不再纯黑；地球光作弱蓝补光。
4. **环形山边缘**：朝向相机一侧抬高、朝太阳一侧压低，轮廓更有层次；顶点色做大尺度明暗和年轻陨石坑的亮溅射。
5. **地球**：大气壳（按相位只亮日照侧）+ 夜间城市灯光 + 云层改用不透明灰度 alpha（避免预乘透明度的黑色边缘）。
6. 色调映射改用 AgX（高光过渡比 ACES 好），可用 `?tm=aces|agx|neutral` 对照。

仍然偏弱的地方：中景起伏平滑、像沙丘；星空放大后会糊（贴图方案的上限，需要换成点精灵星空）；地球是程序化的，接近看会露馅（真实项目应换 NASA Blue Marble）；这些在真实 DEM 和 NAC 影像接入后才会真正解决。Babylon 和 PlayCanvas 两个页面还是第一轮的快照，没有同步这轮升级。

**真实数据接入（`prototypes/lunar-scene-demo/lola.html`）：**
- 下载了 `LDEM_875S_10M.JP2`（62 MB）加标签和 XML，来源 `https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/JP2/`，放在 `prototypes/lunar-scene-demo/data/lola/`。LOLA 南纬 87.5° 到南极，10 米/像素，极射影，参考半径 1737.4 km。
- JP2 里存的是 DN + 32768，高度（米）= (值 − 32768) × 0.5（标签里的 SCALING_FACTOR）。Pillow 能直接解码（约 10 秒）。
- 处理脚本在 `prototypes/lunar-scene-demo/tools/`：`inspect_dem.py`（解码）→ `export_dem.py`（裁出 ±21 km 的 Int16 高度图，并按太阳方位和高度角烘焙远场阴影图）；`horizon.py`、`find_view.py` 用来查地平线和选机位。
- 渲染：`lola.js` 读取高度图、建 mip 金字塔，作为地形基底；过程化的小陨石坑、岩石只补 10 米以下的细节；阴影图在着色器里和近处级联阴影相乘。
- 数据里的发现：极点像素高度约 +1293 m，位于 Shackleton（约 21 km 宽、约 4.2 km 深）边缘附近；太阳高度角 1.5° 时，环形山内部几乎全在阴影里（亮的比例不到 1%），只有边缘被照亮，这是真实现象，不是 bug。
- 极点在太阳方位角 70°–160° 时地平线低于 0°（视野开阔），180°–350° 时被身后的高地挡住（4°–11°）。当前取 62°。
- **起伏过大的反馈：** 极点周围真实 DEM 的坡度中位数约 10°（20 m 基线），主要是 160 m 以上的大尺度地形，是真实的。但前景"尖顶山包"主要是我程序化小陨石坑叠加出来的：近处约 6 个坑相互叠加，高度直接相加，堆出 3–4 m 的坑和锥形尖峰，眼高 1.8 m 看起来就是山。证据：在相隔 9 km 的两个位置看到完全相同的前景。已修：有真实 DEM 时把程序化起伏用 `1.2·tanh(h/1.2)` 限幅，小坑数量 3600→2000，地形采样由双线性改为双三次。
- **更平缓的机位：** `lola.html?spot=a` 和 `?spot=b`，定义在 `lola.js` 的 `SPOTS`。由 `prototypes/lunar-scene-demo/tools/find_spot.py` 在 DEM 里筛出：先要坡度小，再用真实星历算一年（365 天，起点见 `data/derived/sky_year.json`）里太阳、地球高于地形地平线的时间比例。
  - a：距极点 8.9 km，高 1298 m，坡度均值 4.5°（±100 m），太阳可见 72%、地球可见 79%、两者同时 55%。
  - b：距极点 11.9 km，高 930 m，坡度均值 3.4°，太阳 63%、地球 60%、同时 37%。
  - 对照：极点本身坡度均值约 10°，太阳 32%、地球 16%、同时 5%。极点附近大多数地方更陡（平均坡度中位数约 20°），平缓又被照亮的地方很少。
- **时间拖条与真实星历：** `lola.html` 底部的时间面板驱动太阳、地球、星空。
  - 星历：`ephemeris.js`，自包含（截断的 Meeus 月球理论 + 低精度太阳 + IAU 月球自转模型），不下载任何数据。`node tools/check_ephemeris.mjs` 对照 JPL Horizons，6 个日期上月球星下点和日下点最大差 0.010°，距离差 0.011%。精度够做光照和通信窗口的可视化，不能当任务级轨道计算。
  - 四档时间尺度共用同一个当前时间，切换档位时拖条以当前时间为中心重新展开：自转 10 分钟/步（±24 小时，太阳每小时转约 0.5°）、月相与天平动 2 小时/步（±30 天）、公转 1 天/步（±200 天，太阳高度年周期 346.6 天）、长周期 15 天/步（±10 年）。另有 ◀ ▶ 单步、播放、直接输入 UTC 时间的跳转框、跳到活动日的按钮。拖条本身是连续的（分辨率 1/100 步），显示的时间以约 0.1 秒的时间常数滑向目标，所以粗档位下拖一大段也是平滑扫过中间时刻，不会瞬移；方向键按整步，Shift+方向键按 0.1 步，PageUp/PageDown 按 10 步。URL 参数 `?t=YYYY-MM-DDTHH:MM`（UTC）设定初始时间，默认时刻见 `lola.js` 的 `defaultT`（太阳方位角 62°，正是此前调好的构图）。
  - 面板里的时间轴画出太阳和地球的高度曲线，并用黄色（太阳）、蓝色（地球）条标出"高于当前视点地形地平线"的时段，也就是供电窗口和对地直连通信窗口。
  - 远处阴影：`shadowcast.js` + `shadowWorker.js` 在 Web Worker 里按当前太阳方向重算 20 m 的光照遮罩，每次约 80–110 ms，和之前 Python 烘焙的结果在极点 3 km 内一致度 98.5%；近处仍用实时级联阴影。
  - 更正：之前地球固定在方位角 108°、高度 4.2°，是随手定的，不对。从南极看，地球永远在月球近侧方向，方位角 0°±8°，高度在 ±7° 内摆动，所以极点大部分时间看不到地球（被地形挡住，一年只有约 16%）。太阳、地球、星空原先以世界原点为中心，相机在 1.3 km 高处时位置偏低约 1.3°，现在改为跟随相机。
  - 局限：地球贴图是程序化的，自转只是外观；太阳高度修正只考虑了视点离南极点的偏移（球面倾斜），没有算大气或月尘；地平线按 10 m DEM 算，没有考虑 10 m 以下的岩石。
- 局限：地表颜色仍是程序化的，没有真实反照率影像；整块 35 MB 高度图一次性加载，没有分块流式加载；阴影图只考虑了裁剪范围内的地形。

**赤道场景、主页、真人视角：**
- **眼高改为 1.6 m**（真人站立）：`common.js` 里的 `EYE`，南极和程序化场景都用它；地平线计算也用它。南极站点的"太阳/地球可见比例"是按 1.8 m 算的，差别可以忽略，没有重算。
- **渲染加了球面曲率**：真实 DEM 的高度是相对 1737.4 km 参考球的，之前把它当平面画，远处地形比实际高 d²/2R（21 km 处 127 m）。现在 `buildTerrain({ curvature })` 把地面按到相机距离 d 降低 d²/2R，和时间面板里的地平线数组、远处阴影一致。南极三个视点的远景因此略有下沉（最多约 0.35°）。
- **赤道场景：阿波罗 11 号静海基地**（`apollo11.html`，`equator.js`）。
  - 数据：LROC NAC 立体地形模型 `NAC_DTM_APOLLO11.TIF`（v1.9，2 m/像素，32 位浮点 GeoTIFF，118,142,727 字节）和标签 `.LBL`，来源 `https://pds.lroc.im-ldi.com/data/LRO-L-LROC-5-RDR-V1.0/LROLRC_2001/DATA/SDP/NAC_DTM/APOLLO11/`（产品页 `https://data.lroc.im-ldi.com/lroc/view_rdr_product/NAC_DTM_APOLLO11`），存在 `prototypes/lunar-scene-demo/data/lroc/`（经用户同意下载）。等距圆柱投影，覆盖东经 23.37°–23.51°、北纬 0.31°–1.24°（4.2 km × 28 km 的南北向长条），高度相对 1737.4 km 参考球，全条带起伏只有约 260 m。
  - 处理：`python -I tools/export_apollo11.py` 把无数据像素（2.9%）用归一化卷积补上，裁成着陆点南北各 4 km，减去着陆点高度，存成 Int16（0.02 m 一档，16.9 MB）+ `apollo11_meta.json`。场景坐标：x 东、y 上、z 南，原点在着陆点。
  - 视点：着陆点 0.67416°N 23.47314°E（LROC 影像里的"鹰号"下降级位置，误差几米）。它离长条东边缘只有 1.16 km、离西边缘 3.06 km，而眼高处地平线在 2.4 km，所以东边 1.2 km 之外**不是真实数据**：`equator.js` 在数据边缘内 60 m 到外 220 m 之间混入合成地面（区域高度延续 + 缓起伏 + 哈希生成的撞击坑）。`?spot=mid` 站到长条中央，整个地平线圆盘都是真实数据。
  - 地形细节：DTM 本身平缓（着陆点周围 2 m 基线坡度中位数 2°）。程序化小坑和岩块叠上去后近处显得很碎，所以赤道用 `craterDensity 0.5`、`relief 0.45`（程序化起伏高度乘数）、`maxFeatureR 3`。
  - 星历：`ephemeris.js` 抽出公共内核 `skyFrom`，新增 `skyAtLonLat(ms, lat, lon)`（局地坐标 x 东、y 上、z 南，方位角是罗盘方位）。南极原有的 `skyAt` 结果逐位不变（16 个样本逐字节对比）。校验：1969-07-20 20:17 UTC（阿波罗 11 号着陆）算得太阳高度 10.7°、方位 88.8°（史料约 10.8°）。
  - 光照：以前太阳低于 −10° 时关掉太阳光，赤道夜里地球就成了黑盘（地球也靠这盏灯照亮），现在太阳光常开（背面的地面本来就受不到光）。太阳接近天顶时光源仰角限制在 89.3°，避免阴影相机的 up 向量退化。星空亮度随太阳高度从 1 降到 0.35。`exposure()` 钩子留着但目前恒为 1。
  - 远处阴影：赤道用 1024×1024、8 m 的网格（±4 km），每次重算约 14 ms，南极是 2100×2100、20 m。阴影的参考平面是相机所在点的切平面。
  - 默认时间见 `equator.js` 的 `defaultT`：太阳在正东 11° 高，和阿波罗 11 号着陆时的太阳高度一样。"活动日"按钮对应夜里（太阳 −13°），地球 65° 高、81% 亮。地球一直挂在西边天空 60°–70° 高处，需要抬头看（俯仰上限已放宽到 85°）。
  - 时间面板的纵轴范围由站点给出：南极 ±9°，赤道 ±90°（`elRange`）；"公转"档提示改成不针对南极。
  - 局限：地面没有阿波罗 11 号的着陆器和设备模型；DTM 里有一条南北向的拼接缝（两条立体像对的接缝），没处理；岩石是程序化的，不是 DTM 里的真实岩石；地球贴图仍是程序化的。
- **主页和导航**：`index.html` 现在是选地点的主页（卡片来自 `sites.js`，每张带一张从场景里截的缩略图 `thumbs/*.jpg`），旧的三引擎对比页挪到 `engines.html`。所有场景页右上角有 "Home" 按钮和地点下拉菜单（`nav.js`，URL 带 `?shot` 时隐藏）。加地点：在 `sites.js` 的 `SITES` 里加一项，给它一个页面（设置 `window.__SITE`），在 `scene-three.js` 的加载分支里加一行，写一个返回统一结构的加载函数（参考 `lola.js` 的 `loadPole` 和 `equator.js` 的 `loadApollo11`：`camera`、`build`、`far`、`horizon`、`sky(ms)`、`shadowSun(ms)`、`defaultT`、`elRange`、`exposure`、`starGain`）。
- **代码整理**：`demgrid.js`（mip 金字塔 + Catmull-Rom 采样 + 地平线剖面）南极和赤道共用，改造前后南极的 `base()`、地平线、阴影网格逐位一致（4000 个随机点，三个视点）。`window.__dbg` 多了 `site` 和 `data`，调试用。
- **环境提醒**：`node_modules` 不在 git 里，先在 `prototypes/lunar-scene-demo/` 里 `npm install`。原始 NASA 数据（`.JP2`、`.TIF`）也不在 git 里；要重新跑处理脚本时，按上面写的来源地址下载。`data/derived/` 里已有处理好的结果，直接运行不需要原始数据。起服务器：在 `prototypes/lunar-scene-demo/` 目录里执行 `python serve.py 5191`。

**结论：three.js + 自建地形，主选 WebGLRenderer（WebGPU/TSL 未在本次测试里验证）。** Unreal Pixel Streaming 否决（VPS 无 GPU、每个评委一块 GPU、团队无经验）。Cesium 作为"全月背景 / 2D 地图"的辅助或兜底，不作主渲染。

"高清"的真相：公开数据精度有限（南极 LOLA 20 m/像素，局部更细；LROC NAC 影像 0.5–1 m/像素但不是全覆盖的现成瓦片）。**近景的"高清"要靠多层叠加：**
1. 宏观：LOLA DEM 高度图金字塔 + CDLOD 或几何 clipmap，GPU 变形过渡。
2. 中观：程序化撞击坑 / 分形噪声叠加位移（compute pass），补足 20 m 以下细节。
3. 微观：2~3 档 triplanar 细节法线 + 反照率变化（风化土、岩块），可由 AI / Blender 生成无缝贴图。
4. 反照率：LROC WAC 马赛克做底色，重点站点用 NAC 影像补丁。

"太空高清"清单：
- 星空：NASA Deep Star Maps 2020（8k / 16k EXR，约 17 亿颗恒星）+ 银河；HDR 管线 + 泛光。
- 光照：单一高强度平行光（太阳）+ 物理曝光 + 色调映射；月面反射用 Lommel-Seeliger / 简化 Hapke，含 opposition surge、无边缘变暗；地球光作微弱补光；**无大气 → 黑天空、无雾、硬阴影**。
- 阴影：高度图射线步进的长距阴影 compute pass（太阳移动时才重烘）+ 近景级联阴影。这同时就是赛题要的"地平线遮挡"的可视化。
- 地球 / 太阳圆盘：真实大小和相位，大气发光 shader，太阳光晕。
- 工程：相机相对渲染（floating origin）避免 1737 km 半径的 float32 抖动；质量档位自动降级；KTX2 压缩纹理。
- 影视级宣传画面（视频 / 幻灯片）：用 Blender Cycles 离线渲染，不要指望网页实时做到。

已知参考：开源的 [three.js r186 WebGPU 景观渲染器](https://github.com/vvanghelue/webgpu-landscape-rendering)（CDLOD + 长距阴影烘焙 compute，M4 上 3–15 ms）。注意它是程序化岛屿、未做 triplanar / 细节法线 / 数据流式加载，且许可证未写明；只能作参考，不能直接当月球渲染器。

浏览器支持：Chrome / Edge 113+、Safari 26+ 默认开启 WebGPU；Firefox 仅 Windows 和 Apple 芯片 Mac；Linux / Android Firefox 不稳。给评委的链接要有 WebGL2 回退并提示用 Chrome。

AI 能否操作：three.js 有现成 agent 技能包；让 agent 用浏览器工具截图—调参—再截图闭环调画面（Chrome MCP / Playwright）。

其他备选（不推荐为主渲染）：
- Babylon.js 9：内置 Inspector / 节点材质编辑器 / 视差贴图，但地形同样要自建，AI 训练资料少于 three.js。
- CesiumJS + Cesium Moon Terrain：整月 3D Tiles，南极约 5 m，省去地形流式加载；但光照模型受限、画面偏 GIS、需 Cesium ion 账号，有人报告高度偏差约 2.5 km。
- Unity / Godot 网页导出：WebGL2 限制，不如 three.js。

### 5.2 三个核心视图
1. **2D 南极地图**（极射影）：站点标注，叠加光照 / 可见性热力。
2. **3D 站点视角**：站在着陆点看地平线全景，真实地形剪影，太阳和地球圆盘按位置绘制。
3. **时间线**：一个月昼内太阳高度角、地球高度角、可见窗口；两站点 / 两日期并排对比。

### 5.3 计算（后端 / 预计算）
- **太阳 / 地球位置**：JPL Horizons REST API，或 SPICE（后端 Python `spiceypy` + 公开内核），或前端用 `astronomy-engine`（纯 JS，精度约 1 角分，含天平动）。精度要求高时用 SPICE / Horizons，实时交互用预计算表或 JS。
- **地平线遮挡剖面**：对每个站点，用 LOLA DEM 沿各方位角做射线步进，得到"方位角 → 最大遮挡仰角"。这是后端最重的工作，输出成小 JSON，前端直接用。
- **指标**：太阳在遮挡线之上的时段 = 日照；地球同理 = 直连通信窗口；距日落 / 地球落下剩余时间。
- 月球太阳视半径约 0.27°，地球约 1.9°（需用精确值核对），要处理部分遮挡。

### 5.4 数据（公开免费）
- [NASA CGI Moon Kit](https://svs.gsfc.nasa.gov/4720)：全月颜色图 + 位移图，纬度 ±70° 内。
- LOLA 南极 DEM（80°S 以南，20 m/像素）：[NASA PGDA 精化版 `LDEM_80S_20MPP_ADJ.TIF`（约 2.6 GB）](https://pgda.gsfc.nasa.gov/products/90)，或 [MIT 镜像](https://imbrium.mit.edu/BROWSE/LOLA_GDR/POLAR/SOUTH_POLE)。
- NASA Moon Trek 的 WMTS 瓦片（据二手资料无需密钥，需自行核实官方文档）。
- 参考实现：NASA Quickmap、Moon Trek、JPL Horizons。

### 5.5 Blender + AI（可选的锦上添花）
- 用 `blender-mcp` 让 Claude 操作 Blender（Blender 3.0+、Python 3.10+、uv；插件需在 Blender 内启动，监听本地端口）。仅有二手来源，首次命令可能失败，使用前看官方 README。
- 本赛题里 3D 模型（着陆器、设备）是**次要**的；优先保证数据和对比 UI 正确。
- 流程：Blender 里 AI 建模 → 烘焙 AO / 法线 → 导出 glTF → three.js 加载。

### 5.6 VPS 用途
适合：
- 预计算（DEM 切片、地平线剖面、星历表），产出静态 JSON / 瓦片。
- 轻量 API（FastAPI + 缓存 Horizons 结果）和静态文件服务（需 HTTPS 域名，如 Caddy）。
- 团队共用的数据缓存，避免 5 个人各下一遍 2.6 GB 的文件。

不适合：
- 服务器端 3D 渲染（无 GPU）。
- 作为评审访问的唯一后端（单点故障）。**演示用的数据应预计算成静态文件放到 Vercel 上，VPS 宕了也能看。**

## 6. 待决问题
- [ ] 本地组织者对"赛前准备"的态度？
- [ ] 评委用什么设备看（笔记本 / 手机）？决定是否要 WebGL2 回退和性能上限。
- [ ] 覆盖范围：只做南极，还是全月（含阿波罗站点）？阿波罗站点在赤道附近，DEM 要用另一套数据（Moon Kit / SLDEM2015）。（已用 LROC NAC DTM 做了阿波罗 11 号一个站点，其他阿波罗站点的 NAC DTM：阿波罗 17 号 908 MB，太大；12/14/15/16 号的大小没查。）
- [ ] 精度档位：精确（SPICE + 20 m DEM）还是演示级（astronomy-engine + 较低分辨率 DEM）？
- [ ] 是否需要中文界面或多语言？

## 7. 来源
- [三个引擎对比（Cinevva，该站自家卖基于 three.js 的引擎，需交叉验证）](https://app.cinevva.com/blog/2026-06-09-web-game-engines-2026-comparison)
- [three.js WebGPURenderer 手册](https://threejs.org/manual/en/webgpurenderer)
- [Babylon.js 视差贴图文档](https://doc.babylonjs.com/features/featuresDeepDive/materials/using/parallaxMapping)
- [Cesium Moon Terrain](https://cesium.com/platform/cesium-ion/content/cesium-moon-terrain)
- [astronomy-engine](https://npmjs.com/package/astronomy-engine)
- [参赛条款](https://spaceappschallenge.org/legal)
