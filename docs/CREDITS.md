# 素材、数据与 AI 使用登记（CREDITS）

> **比赛规则**（吉隆坡说明会）：不能用有版权的素材；AI 生成内容可以用但**必须标明**；用 NASA 数据有加分，要在视频里说明。
> **规则：新增任何外部素材、数据源或 AI 生成内容，当场登记在这里。没有登记的不得进最终作品。**
> 素材部分由 `leeziqi0531-debug` 维护；每个人新增时直接追加一行即可（表格追加行冲突很少，真的冲突了找 `xbl2602`）。

## 1. 数据源

| 数据 | 来源 | 分辨率/范围 | 许可/备注 | 用在哪里 |
|---|---|---|---|---|
| NASA LRO LOLA 南极高度图 `LDEM_875S_10M` | MIT 镜像 https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/JP2/ | 10 m/像素，南纬 87.5° 至南极 | NASA 公开数据 | 原型的南极场景 |
| NASA LROC NAC 阿波罗 11 号立体地形模型 `NAC_DTM_APOLLO11` | https://pds.lroc.im-ldi.com/data/LRO-L-LROC-5-RDR-V1.0/LROLRC_2001/DATA/SDP/NAC_DTM/APOLLO11/ | 2 m/像素 | NASA PDS 公开数据 | 原型的阿波罗 11 号场景 |
| JPL Horizons | https://ssd.jpl.nasa.gov/horizons/ | — | 仅用于**校验**我们自实现的星历，未直接使用其数据 | 星历精度核对 |
| NASA Moon Trek 瓦片（LRO WAC 全月影像拼图 `LRO_WAC_Mosaic_Global_303ppd_v02`、LOLA 渲染图） | https://trek.nasa.gov/tiles/Moon/EQ/ | WAC 最细约 83 m/像素；LOLA 渲染图约 666 m/像素；等距柱状投影 | NASA 数据；**使用条款未确认**（官方页面只写 "© 2016 Trek"），见 `docs/research/nasa-trek-tiles-for-frontend.md` | 计划：product page 2D 底图（尚未接入） |
| NASA SVS CGI Moon Kit：月球彩色图 `lroc_color_poles_4k.tif`（LRO LROC WAC） | https://svs.gsfc.nasa.gov/4720 | 原图 4096×2048，等距柱状投影；转成 JPG 存为 `public/landing/moon-color-4k.jpg` | NASA 公开数据（NASA Scientific Visualization Studio） | landing page 的月球（首屏和滚动动画） |
| NASA SVS CGI Moon Kit：月球高程图 `ldem_3_8bit.jpg`（LRO LOLA） | https://svs.gsfc.nasa.gov/4720 | 原图 1024×512；存为 `public/landing/moon-height-1k.jpg`，只用来做坑洞的明暗起伏 | NASA 公开数据 | landing page 的月球 |
| NASA Blue Marble Next Generation `world.topo.bathy.200412.3x5400x2700.jpg` | https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-topography-bathymetry/december/world.topo.bathy.200412.3x5400x2700.jpg | 原图 5400×2700；缩小到 2048×1024 存为 `public/landing/earth-blue-marble-2k.jpg` | NASA 公开数据（NASA Earth Observatory / Visible Earth） | landing page 的地球 |

## 2. 算法与代码来源

- 星历：自实现，截断的 Meeus 月球理论 + 低精度太阳 + IAU 月球自转模型；对照 JPL Horizons 校验（见 PROJECT_CONTEXT）。
- 渲染：three.js（MIT 许可）。
- 第三方 npm 包的许可，进入产品后由 `xbl2602` 汇总。

## 3. 图片 / 字体 / 音乐 / 模型 / 视频素材

> 每新增一项，登记：名称、文件位置、来源链接、许可、是否 AI 生成、（AI 生成的）提示词、登记人、日期。

| 名称 | 文件位置 | 来源/许可 | 是否 AI 生成 | 提示词 | 登记人 | 日期 |
|---|---|---|---|---|---|---|
| 主页缩略图 | `prototypes/lunar-scene-demo/thumbs/` | 我们自己场景的截图，无外部素材 | 否（场景由 AI 辅助编写的代码渲染） | — | xbl2602 | |
| landing page 月面视角图（HD 渲染）5 张 | `public/landing/shot-earthrise-hd.jpg`、`shot-crater-rim-hd.jpg`、`shot-long-shadows-hd.jpg`（画廊）、`panorama-rim-hd.jpg`（"Stand there first" 卡片）、`panorama-sky-hd.jpg`（"forecast" 卡片背景） | 用我们自己的南极场景渲染器（`src/ui/landing/surface-renderer.ts`，地形是 NASA LOLA 南极数据 + 程序生成的细节）重新渲染，1920×1280 / 3840×1080 / 3000×760，无外部素材；取代了之前从原型复制的低清截图 | 否（场景由 AI 辅助编写的代码渲染，不是 AI 生成的图片） | — | chanjy0806 | 2026-11-14 |
| 阿波罗 15 号哈德利月面全景 | `public/landing/apollo-15-hadley.webp`、`public/landing/forecast-ground.webp` | NASA、USGS 和 Apollo 15 crew，[Astronaut Exploring: An Apollo 15 Panorama](https://science.nasa.gov/image-article/apod-2018-november-11-astronaut-exploring-an-apollo-15-panorama/)。美国政府任务影像，按 [NASA 媒体使用指引](https://www.nasa.gov/nasa-brand-center/images-and-media/) 署名使用。源图 4000×723，裁切照片拼接边缘后以 WebP 展示；地表局部裁切仅为阿波罗 11 号天空预报的示意前景。 | 否 | — | chanjy0806 | 2026-11-14 |
| 阿波罗 11 号着陆点轨道照片 | `public/landing/site-apollo-11-lroc.png` | NASA LRO 相机（LROC M175124932R）"Apollo 11 From Low Altitude"，署名 NASA/GSFC/Arizona State University；来自 https://lroc.im-ldi.com/images/484 。NASA 任务影像，一般按公共领域使用；**LROC 网站页脚写 "All rights reserved"，请 `leeziqi0531-debug`/`xbl2602` 确认后再用于最终提交** | 否 | — | chanjy0806 | 2026-11-14 |
| 嫦娥四号着陆点轨道照片 | `public/landing/site-change-4-lroc.png` | NASA LRO 相机（LROC M1303619844LR），署名 NASA/GSFC/Arizona State University；来自 https://lroc.im-ldi.com/images/1092 ；许可备注同上，**待确认** | 否 | — | chanjy0806 | 2026-11-14 |
| 月船三号着陆点轨道照片 | `public/landing/site-chandrayaan-3-lroc.png` | NASA LRO 相机（LROC M1447750764LR），署名 NASA/GSFC/Arizona State University；来自 https://lroc.im-ldi.com/images/1314 ；EurekAlert 将其标为公共领域，但 LROC 页脚许可备注同上，**待确认** | 否 | — | chanjy0806 | 2026-11-14 |
| landing page 的星空、云层、太阳（米粒组织、黑子、临边昏暗、日珥）、光照效果 | `src/ui/landing/space-shaders.ts`、`shader-chunks.ts` | 用代码（着色器）画的装饰效果，太阳的样子参照公开的太阳照片但不是真实数据，无外部素材，不是真实数据；月球和地球表面用的是下面"数据源"表里的 NASA 贴图 | 是（代码由 AI 辅助编写） | 见 `docs/logs/chanjy0806/2026-11-14.md` | chanjy0806 | 2026-11-14 |

## 4. AI 辅助声明

- 本项目的代码和文档在 AI 辅助下完成（Claude 等 AI 编程工具）；使用 AI 生成的**图像、视频、音频、文案**需要在上表单独登记，并在最终视频/提交说明中标明。
- 地形、星历等科学内容以公开数据和对照校验为准，不以 AI 生成内容当作数据。

## 5. 预设点位坐标出处

> 预设着陆点的坐标**必须有出处**（官方文档/可靠数据库），不得凭记忆填写。

| 点位 | 坐标 | 出处链接 | 核对人 | 日期 |
|---|---|---|---|---|
| 阿波罗 11 号 | 0.67416°N 23.47314°E | 原型使用值，来自 LROC 影像中"鹰号"下降级位置（见 PROJECT_CONTEXT），误差几米 | xbl2602 | |
| 嫦娥四号（landing page"三个著名着陆点"） | 45.457°S 177.589°E | NASA LROC 根据影像定位的着陆器位置，误差约 ±20 m：https://www.lroc.asu.edu/posts/1087 | chanjy0806 | 2026-11-14 |
| 月船三号 Chandrayaan-3（Statio Shiv Shakti，landing page"三个著名着陆点"） | 69.373°S 32.319°E | IAU 批准的地名条目所列坐标，转引自 https://en.wikipedia.org/wiki/Statio_Shiv_Shakti ；另有文档写 69.3676°S 32.3481°E，两者相差约 0.03°，**未能核对哪个更准** | chanjy0806 | 2026-11-14 |
