# 素材、数据与 AI 使用登记（CREDITS）

> **比赛规则**（吉隆坡说明会）：不能用有版权的素材；AI 生成内容可以用但**必须标明**；用 NASA 数据有加分，要在视频里说明。
> **规则：新增任何外部素材、数据源或 AI 生成内容，当场登记在这里。没有登记的不得进最终作品。**
> 素材部分由 `leeziqi0531-debug` 维护；每个人新增时直接追加一行即可（表格追加行冲突很少，真的冲突了找 `xbl2602`）。

## 1. 数据源

| 数据 | 来源 | 分辨率/范围 | 许可/备注 | 用在哪里 |
|---|---|---|---|---|
| NASA LRO LOLA 南极高度图 `LDEM_875S_10M` | MIT 镜像 https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/JP2/ | 10 m/像素，南纬 87.5° 至南极 | NASA 公开数据 | 原型的南极场景 |
| NASA LROC NAC 阿波罗 11 号立体地形模型 `NAC_DTM_APOLLO11` | https://pds.lroc.im-ldi.com/data/LRO-L-LROC-5-RDR-V1.0/LROLRC_2001/DATA/SDP/NAC_DTM/APOLLO11/ | 2 m/像素 | NASA PDS 公开数据 | 原型的阿波罗 11 号场景 |
| NASA LRO LOLA 全月高度图 `LDEM_64` | https://imbrium.mit.edu/DATA/LOLA_GDR/CYLINDRICAL/IMG/LDEM_64.IMG（NASA PDS 地球科学节点 LOLA GDR；Smith et al. 2010, Space Sci. Rev. 150, 209–241） | 64 像素/度 = 473.8 m/像素，23040×11520，Int16，高度 = 值 × 0.5 m（相对 1737.4 km 参考球）。**原始文件不进 git**（约 506 MB，放 `data/raw/lola-global/`） | NASA 公开数据 | `pipeline/` 从它算出地形、地平线、一年日照/对地可见统计（衍生数据在 `public/data/v1/`，约 55 MB，**是我们自己算的衍生数据，不是 NASA 原文件**，处理方法见 `pipeline/README.md` 和 `manifest.json`） |
| NASA LRO LOLA 南极高度图 `LDEM_80S_40M`（南纬 80° 到南极） | https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/IMG/LDEM_80S_40M.IMG（标签同名 `.LBL`；NASA PDS 地球科学节点 LOLA GDR；Smith et al. 2010, Space Sci. Rev. 150, 209–241） | 40 m/像素，15200×15200，Int16，高度 = 值 × 0.5 m（相对 1737.4 km 参考球），极立体投影、极点处比例尺为 1。**原始文件不进 git**（462,080,000 字节，放 `data/raw/lola-south/`）。2026-11-15 xbl2602 登记 | NASA 公开数据 | `pipeline/` 南极高精度预计算（`build-polar-terrain.mjs`，计划中的地平线与多年统计也以它为输入）。**衍生数据是我们自己算的，不是 NASA 原文件**；处理方法见 `docs/decisions/2026-11-15_xbl2602_polar-highres-data-and-routing.md` |
| 南极 160 m 地形包 `public/data/polar-v1/`（**我们自己算的衍生数据**，输入是上面的 `LDEM_80S_40M`） | 脚本 `pipeline/build-polar-terrain.mjs`、`pipeline/build-polar-package.mjs` | 南纬 80° 到南极，160 m 格子（40 m 像素 4×4 平均），高度和坡度，压缩后共约 17 MB | 同上署名（NASA/GSFC，LRO LOLA）；处理方式见 `public/data/polar-v1/manifest.json`，验证见 `pipeline/validate-polar.mjs` | `/api/point` 等单点接口的南极点（地平线在查询时现算） |
| JPL Horizons | https://ssd.jpl.nasa.gov/horizons/ | — | 仅用于**校验**我们自实现的星历，未直接使用其数据。2026-11-15 起把 8 个月面观测点 × 14 个时刻（2005-2090 年）的太阳/地球方位角和高度角抓下来存成 `src/core/ephemeris/tests/horizons-lunar-surface.json`，进入自动测试（脚本 `pipeline/fetch-horizons-lunar-surface.py`）。实测最大偏差 0.013° | 星历精度核对、CI 回归测试 |
| NASA LOLA 极区平均太阳光照 / 平均地球可见性 `AVGVISIB_65S_240M_201608{,_EARTH}.IMG`（LOLA 团队，Mazarico et al. 2011, Icarus 211, 1066–1081） | PDS 地球科学节点 https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/extras/illumination/release_2016/img/（产品页 https://pgda.gsfc.nasa.gov/products/69） | 240 m/像素，6420×6420，Int16，值 = DN × 0.00004（0–1 可见比例），极立体投影，覆盖 18.6 年（完整章动周期）每小时一步的平均。**原始文件不进 git**（各约 82 MB，放 `data/raw/lola-illumination/`） | NASA 公开数据，引用 Mazarico et al. (2011)；**仅用于校验，我们的统计是自己算的**。2026-11-15 xbl2602 登记。对照脚本 `pipeline/validate-vs-nasa-illumination.mjs`：40 个随机点地球可见性 RMS 0.076、太阳 RMS 0.036；Shackleton/Faustini/Cabeus/Haworth/de Gerlache/Slater 永久阴影两边都是 0 | 极区太阳/地球可见统计的独立对照（TODO 第 20 行） |
| 太阳常数 1360.8 W/m² | Kopp & Lean (2011), Geophysical Research Letters 38, L01706（SORCE/TIM 卫星测量的太阳总辐照度，论文原文摘要：2008 年太阳极小期 1360.8 ± 0.5 W/m²） | 一个数 | 常数写在 `src/core/data/solar-energy.ts`，按日地距离平方反比修正；2026-11-15 已找到并核对论文原文（GRL L01706），数值与引用无误 | `/api/energy`、MCP `get_solar_energy_estimate` |
| NASA SVS "CGI Moon Kit" 彩色图 `lroc_color_poles_8k.tif`（LRO WAC 拼图，NASA/GSFC/Arizona State University） | https://svs.gsfc.nasa.gov/4720 | 8192×4096，全月简单圆柱投影；转成 `public/product/moon/color-8k.jpg`、`color-4k.jpg` | NASA SVS 要求署名 "NASA's Scientific Visualization Studio"；页面说明"为美观优化，不用于科学"——所以只当底图，数值计算用 LOLA。2026-11-14 ShanLe1224 登记 | Lunar Quest 产品页 2D/3D 底图、第一人称地面颜色 |
| NASA SVS "CGI Moon Kit" 高度 `ldem_16_uint.tif`（LRO LOLA，NASA/GSFC） | https://svs.gsfc.nasa.gov/4720 | 5760×2880（1/16°，赤道约 1.9 km/像素），16 位整数，单位半米，偏移 10 km | 同上署名。生成脚本 `src/ui/product/data-build/build-moon-textures.mjs`，产物 `public/product/moon/`（relief/normal/slope 4K 图 + 648 块 16 位高度切片） | 3D 起伏与阴影、2D 光照/高度/坡度图层、第一人称地形 |
| IAU 月面地名表（Gazetteer of Planetary Nomenclature，USGS Astrogeology 代 IAU 维护，NASA 资助）`MOON_nomenclature_center_pts.zip` | https://planetarynames.wr.usgs.gov/GIS_Downloads | 9087 条 IAU 已采纳的月面地名：名称、类型、中心经纬度、直径 | 下载页没有写使用条款；美国政府机构数据。转成 `public/product/moon/lunar-names.json`（脚本 `src/ui/product/data-build/build-lunar-names.mjs`）。2026-11-14 ShanLe1224 登记 | Lunar Quest "Search Location" 工具 |
| 极区光照预计算 `public/product/moon/polar-light-4k.png`（**我们自己算的衍生数据**，输入是上面的 LOLA `ldem_16_uint.tif`） | 脚本 `src/ui/product/data-build/build-polar-light.mjs` | 南北纬 80° 以上；约 1.9 km 分辨率；永久阴影、全年光照比例、离永久阴影的距离 | **模型，不是观测**。自检：沙克尔顿、肖梅克、霍沃斯、福斯蒂尼坑底算出为永久阴影，沙克尔顿坑沿全年 87% 有光。2026-11-14 ShanLe1224 登记 | Solar Illumination、Water Ice Potential、Site Suitability 图层 |
| NASA Moon Trek 瓦片（LRO WAC 全月影像拼图 `LRO_WAC_Mosaic_Global_303ppd_v02`、LOLA 渲染图） | https://trek.nasa.gov/tiles/Moon/EQ/ | WAC 最细约 83 m/像素；LOLA 渲染图约 666 m/像素；等距柱状投影 | NASA 数据；**使用条款未确认**（官方页面只写 "© 2016 Trek"），见 `docs/research/nasa-trek-tiles-for-frontend.md` | 计划：product page 2D 底图（尚未接入） |
| NASA SVS CGI Moon Kit：月球彩色图 `lroc_color_poles_4k.tif`（LRO LROC WAC） | https://svs.gsfc.nasa.gov/4720 | 原图 4096×2048，等距柱状投影；转成 JPG 存为 `public/landing/moon-color-4k.jpg` | NASA 公开数据（NASA Scientific Visualization Studio） | landing page 的月球（首屏和滚动动画） |
| NASA SVS CGI Moon Kit：月球高程图 `ldem_3_8bit.jpg`（LRO LOLA） | https://svs.gsfc.nasa.gov/4720 | 原图 1024×512；存为 `public/landing/moon-height-1k.jpg`，只用来做坑洞的明暗起伏 | NASA 公开数据 | landing page 的月球 |
| 月球撞击坑数据库（Robbins 2018，USGS Astrogeology "Moon Crater Database v1 Robbins"），直径 ≥ 1 km 的约 130 万个坑 | `public/product/moon/craters/*.bin`（10°×10° 小块）、`craters-meta.json`；生成脚本 `src/ui/product/data-build/build-crater-tiles.mjs` | https://astrogeology.usgs.gov/search/map/moon_crater_database_v1_robbins ；引用：Robbins, S. J. (2019), *A New Global Database of Lunar Impact Craters >1-2 km: 1. Crater Locations and Sizes…*, JGR Planets 124, 871–892, doi:10.1029/2018JE005592。下载的是 USGS 提供的 `lunar_crater_database_robbins_2018.csv`（约 2 百万行，238 MB），只保留经纬度、直径和坑沿完整度，量化后每个坑 7 字节，共约 9 MB。**许可待 xbl2602 / leeziqi0531-debug 复核**（USGS 公开数据，要求引用作者） | 否 | — | chanjy0806 | 2026-11-15 |
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
| 阿波罗 11 号静海基地实拍地表 | `public/landing/forecast-tranquility.webp` | Neil Armstrong / Apollo 11 / NASA，[Apollo 11 Landing Panorama](https://science.nasa.gov/image-article/apod-2024-july-20-apollo-11-landing-panorama/)。按 [NASA 媒体使用指引](https://www.nasa.gov/nasa-brand-center/images-and-media/) 署名使用。源图裁切为预报画面的地表前景；星历与照片分别呈现。 | 否 | — | chanjy0806 | 2026-11-14 |
| 阿波罗 11 号着陆点轨道照片 | `public/landing/site-apollo-11-lroc.png` | NASA LRO 相机（LROC M175124932R）"Apollo 11 From Low Altitude"，署名 NASA/GSFC/Arizona State University；来自 https://lroc.im-ldi.com/images/484 。NASA 任务影像，一般按公共领域使用；**LROC 网站页脚写 "All rights reserved"，请 `leeziqi0531-debug`/`xbl2602` 确认后再用于最终提交** | 否 | — | chanjy0806 | 2026-11-14 |
| 嫦娥四号着陆点轨道照片 | `public/landing/site-change-4-lroc.png` | NASA LRO 相机（LROC M1303619844LR），署名 NASA/GSFC/Arizona State University；来自 https://lroc.im-ldi.com/images/1092 ；许可备注同上，**待确认** | 否 | — | chanjy0806 | 2026-11-14 |
| 月船三号着陆点轨道照片 | `public/landing/site-chandrayaan-3-lroc.png` | NASA LRO 相机（LROC M1447750764LR），署名 NASA/GSFC/Arizona State University；来自 https://lroc.im-ldi.com/images/1314 ；EurekAlert 将其标为公共领域，但 LROC 页脚许可备注同上，**待确认** | 否 | — | chanjy0806 | 2026-11-14 |
| 太阳照片（SDO/AIA 171 Å，4096×4096，2026-11-14 09:47 UT 一帧） | `public/landing/sun-sdo-171-4k.jpg` | NASA Solar Dynamics Observatory，来自 https://sdo.gsfc.nasa.gov/assets/img/latest/latest_4096_0171.jpg ；NASA 任务影像，按 NASA 媒体使用指引署名使用；颜色是 171 Å 极紫外波段的标准伪彩色，不是肉眼所见的白光太阳；已涂黑左下角的日期文字 | 否 | — | chanjy0806 | 2026-11-14 |
| 月球彩色图 6144×3072 | `public/landing/moon-color-6k.jpg` | 由 NASA SVS CGI Moon Kit 的 `lroc_color_poles_8k.tif`（https://svs.gsfc.nasa.gov/4720 ）缩小得到，用于滚动故事里放大的月球 | 否 | — | chanjy0806 | 2026-11-14 |
| 月面起伏图 4096×2048 | `public/landing/moon-relief-4k.jpg` | 由 NASA SVS Moon Kit 的 LOLA 高程图 `ldem_16_uint.tif`（5760×2880，约 1.9 km/像素）做"去掉大尺度形状"的高通处理后编码成 8 位灰度（每级约 14 m），只用来给月球着色器算坑洞的明暗，不是可测量的高程数据 | 否 | — | chanjy0806 | 2026-11-14 |
| 月面高度图 2048×1024（console 背景里判断基地是否被地形挡住） | `public/landing/moon-height-2k.png` | 由 NASA SVS Moon Kit / LRO LOLA 的 16 位高程图 `ldem_16_uint`（h = DN×0.5 − 10000 米）缩小并压成 8 位（-9200 m 到 +10800 m），只在网页里读高度用，不直接显示 | 否 | — | chanjy0806 | 2026-11-15 |
| console 背景月面近景地形图 2 张（120 km 与 480 km 见方，可无缝平铺） | `public/landing/lunar-detail-a.png`、`lunar-detail-b.png`，生成脚本 `src/ui/landing/bake-lunar-detail.mjs` | **我们自己用脚本生成**，无外部素材：按月面撞击坑的统计规律（大小服从 N(>D)∝D^-2 幂律、浅坑到深坑的深径比随年龄变化、复杂坑 D>18 km 的深径比取 Pike (1977) 经验式 d≈1.044·D^0.301、平底和中央峰、坑缘与按 r^-3 衰减的溅射毯、新坑亮溅射物），从老到新依次盖章。不是某一块真实月面的照片或高程数据，只是统计上真实的地形。 | 是（由 AI 辅助编写的脚本生成，无提示词素材） | 见脚本注释 | chanjy0806 | 2026-11-15 |
| 进入产品页的像素风加载动画（豆子漂移过弯） | `src/ui/landing/drift-scene.ts`、`drift-car.ts`、`pixel-draw.ts`、`product-transition.tsx` | **全部用代码画成**，无外部素材：S 形赛道（两个发卡弯，随车前进在车前方逐段铺出）、车（用方块和面板搭的小 3D 模型，再画成像素）、豆子、烟都是矩形、多边形和圆组成的像素图。造型参考的是团队提供的豆子吉祥物插画（戴墨镜开漂移的豆子），只借用了“绿色圆豆子 + 墨镜 + 白黑双色小车 + 白烟”的构思，没有使用原图。 | 是（由 AI 辅助编写的代码生成，无提示词素材） | 见源码注释 | chanjy0806 | 2026-11-15 |
| console 背景里的中继卫星 3D 模型与贴图 | `src/ui/landing/satellite-model.ts`、`bake-satellite.mjs`、`public/landing/satellite/`（`foil/panel/dish` 的 color 与 normal PNG、`ao.json`） | 我们自己用代码建的模型（圆角盒、抛物面天线、三节太阳翼），**非真实卫星外形**；颜色/法线贴图由脚本程序生成，遮蔽（AO）由脚本离线射线烘焙；无外部素材 | 是（由 AI 辅助编写的代码生成，无提示词素材） | 见 `bake-satellite.mjs` 注释 | chanjy0806 | 2026-11-15 |
| landing page 的星空、云层、首屏太阳（米粒组织、黑子、日珥的程序化画法）、月球与太空场景、ASCII 终章动画、月球通信示意（中继轨道器、直连地球、频段标注，速率为示意值）、光照效果 | `src/ui/landing/space-shaders.ts`、`shader-chunks.ts` | 用代码（着色器）画的装饰效果，太阳的样子参照公开的太阳照片但不是真实数据，无外部素材，不是真实数据；月球和地球表面用的是下面"数据源"表里的 NASA 贴图 | 是（代码由 AI 辅助编写） | 见 `docs/logs/chanjy0806/2026-11-14.md` | chanjy0806 | 2026-11-14 |

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
| 阿波罗 12/14/15/16/17 号（预设点位，登月舱位置） | 12：3.0128°S 23.4219°W；14：3.64589°S 17.47194°W；15：26.13239°N 3.6333°E；16：8.9734°S 15.5011°E；17：20.1911°N 30.7723°E | NASA NSSDCA "Apollo Landing Site Coordinates"（MEAN_ME 坐标系，LRO 影像定位，Wagner et al. 2017, Icarus 283）：https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html ；LROC 2016 坐标表里能辨认出的数值与之一致（该 PDF 抽出的文字表格行列错乱，只用来核对） | xbl2602 | 2026-11-15 |
| 嫦娥三号（广寒宫）、嫦娥五号（天川站）、嫦娥六号（天江站）、月船三号（预设点位） | 嫦三 44.1184°N 19.5123°W；嫦五 43.06°N 51.92°W；嫦六 41.63°S 153.98°W；月船三号 69.3734°S 32.3198°E | IAU 月面地名库（USGS）里这些着陆点地名条目的中心点，坐标只保证约 2 位小数（约 300 m）；条目在 `public/product/moon/lunar-names.json`。月船三号与上一表的另一份文档值相差约 0.03°，预设采用 IAU 值 | xbl2602 | 2026-11-15 |
| 嫦娥四号（预设点位） | 45.457°S 177.589°E | 同上一条 landing page 的行：NASA LROC 影像定位，±20 m。我重新打开了该页面，确认数值与页面一致：https://www.lroc.asu.edu/posts/1087 | xbl2602 | 2026-11-15 |
| 南极 10 个地名（Shackleton、Mons Malapert、Haworth、Nobile、Faustini、Cabeus、Amundsen、de Gerlache、Slater、Mons Mouton；预设点位） | 见 `src/core/data/presets.ts` | IAU 月面地名库（USGS）的**地名中心点**，坐标保证约 2 位小数；**只代表"这个地名在哪"，不是任何任务的着陆目标**（预设描述里已写明）。Artemis III 候选区的官方坐标仍未核实，没有写进来 | xbl2602 | 2026-11-15 |
| 南极着陆器 IM-1 奥德修斯号、IM-2 雅典娜号（预设点位） | IM-1：80.13°S 1.44°E；IM-2：84.7906°S 29.1957°E | IM-1：NASA 文章 "NASA's LRO Images Intuitive Machines' Odysseus Lander" 正文 "Odysseus landed at 80.13 degrees south latitude, 1.44 degrees east longitude"：https://www.nasa.gov/missions/lro/nasas-lro-images-intuitive-machines-odysseus-lander/ 。IM-2：LROC 图说 "IM-2 Athena Seen Obliquely"，括号里 "(84.7906° S, 29.1957° E)"：https://lroc.im-ldi.com/images/1408 ；LROC 公布的原计划着陆点 84.78°S 29.13°E 见 https://lroc.im-ldi.com/images/1401（与实际点相差约 0.4 km，测试里有检查）。三处页面我都下载后读了原文 | xbl2602 | 2026-11-15 |
| SLIM、Blue Ghost 1（预设点位） | SLIM：13.3160°S 25.2510°E；Blue Ghost 1：18.5623°N 61.8103°E | SLIM：NASA "NASA's LRO Spots Japan's Moon Lander" 正文 "13.3160 degrees south latitude, 25.2510 degrees east longitude"：https://www.nasa.gov/missions/lro/nasas-lro-spots-japans-moon-lander/ 。Blue Ghost 1：LROC 图说 "The Blue Ghost lander (18.5623°N, 61.8103°E, -3650 meters elevation)"：https://lroc.im-ldi.com/images/1407 。页面原文都读过 | xbl2602 | 2026-11-15 |
| 勘测者 1/3/5/6/7 号、月球 16/17/20/21/23/24 号（预设点位，共 11 个着陆器） | 见 `src/core/data/presets.ts` | LROC 团队 "Coordinates of Lunar Anthropogenic Targets"（2016-07-28，平均观测坐标，月固系，表里给了每个点的不确定度）：https://www.lroc.asu.edu/data/support/downloads/2016_LROC_Coordinates_of_Robotic_Spacecraft.pdf 。**该 PDF 直接抽文字会错行**（和上面阿波罗那条一样），我按文字在页面上的位置重建了表格（名字那一行的下一行是它的数值）。表里经度是 0~360°E，已换成 -180~180°E。**交叉核对**：勘测者 3 号距阿波罗 12 号登月舱约 160 m、勘测者 5 号距阿波罗 11 号约 25 km，与史实一致（两份来源互不相干，`src/core/data/tests/presets.test.cjs` 里有这两个检查）。月球 17/21 号取的是着陆器，不是月球车的最后位置。**没收**：月球 9/13 号（该表里没有）、各次撞击坑 | xbl2602 | 2026-11-15 |
| 南极新增 7 个地名（Shoemaker、Sverdrup、Henson、Wiechert、Kocher、Oberbeck、Scott；预设点位） | 见 `src/core/data/presets.ts` | IAU 月面地名库（USGS）的**地名中心点**，取自仓库里已登记的 `public/product/moon/lunar-names.json`，不是着陆目标。描述里的直径、离极点的度数都是用地名库里的数算的。**中文名是我按通行译法写的，没有逐个对照官方译名表（尤其是科歇尔、斯韦德鲁普、维歇特），请懂的人校对**；界面目前没有用到中文名 | xbl2602 | 2026-11-15 |
| console 背景里的月面基地（13 个真实着陆点：Luna 9/13/16/24、Surveyor 1/6、Apollo 11/12/14/16/17、SLIM、Blue Ghost 1） | 见 `src/ui/landing/lunar-bases.ts` | 坐标取自维基百科 "List of artificial objects on the Moon" 的表（该表引用 NASA/LROC 与各航天机构），**待 xbl2602 / leeziqi0531-debug 复核**；IM-1 一行的坐标看起来不对，已弃用 | chanjy0806 | 2026-11-15 |
| console 背景里的 6 个**虚构**远侧基地（far-1 到 far-6） | `src/ui/landing/lunar-bases.ts`（`real: false`） | 纯属编造，只为让卫星飞越远侧时也有可连的基地；画面里没有文字，不会被当成真实任务。如需公开说明，请注明是示意 | chanjy0806 | 2026-11-15 |
| 产品页 Landing Sites 模式的 25 个着陆点（载人 6 个：Apollo 11/12/14/15/16/17；无人 19 个：Luna 9/13/16/17/20/21/24、Surveyor 1/3/5/6/7、嫦娥三/四/五/六号、月船三号、SLIM、Blue Ghost 1） | `src/ui/product/modes/historic-landing-sites.ts` | 有 IAU 着陆站名的 6 个（Apollo 11、嫦娥三/四/五/六号、月船三号）取自 IAU 地名表（见上，坐标由代码按名字读取，不手写）；**其余 19 个**坐标取自维基百科 "List of artificial objects on the Moon" 的表（该表引用 NASA/LROC 与各航天机构），度分秒换算成十进制度，精度约 0.01°；和 `lunar-bases.ts` 里重合的 12 个非 IAU 点位互相对得上（差在 0.01° 以内）。任务介绍文字（日期、机构、样本量）为我根据公开资料概括，**日期和数字待 xbl2602 / leeziqi0531-debug 复核**。只收成功软着陆的任务，撞毁的（Luna 25、Beresheet、Vikram 等）不收；IM-1/IM-2、Luna 23 的坐标没核对过，先不放 | chanjy0806 | 2026-11-15 |

## 3D globe sky imagery (2026-11-14, ShanLe1224 / Codex)
| Asset | Local file | Source and rights | Processing / limitations |
|---|---|---|---|
| NASA Blue Marble land/ocean/ice | public/product/sky/earth-8k.jpg and earth-4k.jpg | NASA Visible Earth, public domain NASA work; downloaded from https://commons.wikimedia.org/wiki/File:Nasa_land_ocean_ice_8192.jpg (original 8192 x 4096); background: https://svs.gsfc.nasa.gov/2915 | JPEG recompression and 4096 x 2048 fallback; no AI generation. Fixed reference map, not live weather or a calibrated Earth orientation model. |
| NASA SDO AIA 171 Angstrom Sun, 2024-05-23 00:07:10 | public/product/sky/sun-sdo-4k.jpg | https://sdo.gsfc.nasa.gov/assets/img/browse/2024/05/23/20240523_000710_4096_0171.jpg ; usage: https://sdo.gsfc.nasa.gov/data/rules.php ; Courtesy of NASA/SDO and the AIA, EVE, and HMI science teams. Not copyrighted unless explicitly noted. | Original 4096 x 4096 JPEG, no AI generation. Fixed false-colour EUV reference image, not a live visible-light Sun. Position follows simulation time; the same Sun vector drives Moon shadows and Earth phase. |

| NASA LROC 16K Moon colour map | public/product/moon/color-16k.jpg | NASA SVS CGI Moon Kit https://svs.gsfc.nasa.gov/4720 ; original https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_16k.tif ; credit NASA's Scientific Visualization Studio / NASA/GSFC/ASU | Same 2019 colour mosaic as the existing 4K/8K assets; 16384 x 8192, JPEG quality 95 with 4:4:4 chroma, no upscaling or AI generation. Offline builder: src/ui/product/data-build/build-moon-color-16k.mjs. Added 2026-11-14 by ShanLe1224 / Codex. |

## Progressive close-up lunar imagery (2026-11-14, ShanLe1224 / Codex)
- Display-only NASA Moon Trek WMTS layer LRO_WAC_Mosaic_Global_303ppd_v02. Public API documentation: https://trek.nasa.gov/tiles/apidoc/ ; capabilities https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/WMTSCapabilities.xml ; data credit NASA/GSFC/Arizona State University, LROC Team.
- 256-pixel JPEG tiles, maximum level 8 (131072 x 65536 equivalent global imagery, approximately 83 m/pixel at the equator). Fetched on demand in the browser with four concurrent requests and a bounded cache; no API key. No AI-generated imagery.
- These photographs contain acquisition-time shading. They improve visible surface detail only; they do not increase terrain-model resolution or change numerical sun/communication analysis. Existing simulated lighting is still applied. The local NASA global map remains the fallback when tiles are unavailable.

## Product page on-demand imagery (2026-11-15, xbl2602 / Claude)
No new external sources and no AI-generated content. Everything below is a resize or crop of assets already listed above; see `docs/decisions/2026-11-15_xbl2602_product-on-demand-rendering.md`.
| Asset | Local file | Derived from | Processing |
|---|---|---|---|
| Colour-map tiles, level 3 (8192 px wide) and level 4 (16384 px wide) | `public/product/moon/color-tiles/{3,4}/` (512 px JPEG, quality 86) | `public/product/moon/color-16k.jpg` (NASA SVS CGI Moon Kit, credit NASA's Scientific Visualization Studio / NASA/GSFC/ASU) | Cut and resized offline by `src/ui/product/data-build/build-texture-levels.mjs`; loaded on demand when zoomed in |
| 2K versions of the LOLA-derived normal, relief, slope and polar-light maps | `public/product/moon/normal-2k.jpg`, `relief-2k.png`, `slope-2k.jpg`, `polar-light-2k.png` | The existing 4K files in the same folder (NASA LRO LOLA, see the LOLA entries above) | Downscaled by the same script; used first, the 4K versions follow in the background |
| Small Earth and Sun textures for the 3D sky | `public/product/sky/earth-2k.jpg`, `sun-sdo-1k.jpg` | `earth-8k.jpg` (NASA Blue Marble) and `sun-sdo-4k.jpg` (NASA SDO AIA 171 Å, false colour) | Downscaled by the same script |


## First-person view: Sun and Earth in the sky (2026-11-15, chanjy0806 / Claude)
- **Earth**: the existing NASA Blue Marble file `public/product/sky/earth-4k.jpg` (listed above), now also used on a lit sphere in the first-person sky (`src/ui/product/first-person/earth-sky.ts`). Phase comes from the real Sun direction. Which side of Earth faces the Moon is computed with a simplified low-precision Moon position (Meeus-style series, about 1 to 2 degrees) and Greenwich sidereal time; Earth's axis direction is approximated by the lunar north direction, with no 23.4 degree axial tilt. So the continents on show are about right, not exact. No new external asset.
- **Sun**: drawn in code (`sky-objects.ts`): a white disc with glare and faint cross spikes, like an overexposed camera frame. No image or AI-generated asset. The white core is a little larger than the real 0.27 degree radius on purpose, so it stays clear on screen.
- **Photo button**: saves the current view as a PNG with a caption (place, UTC time, Sun elevation, "Lunar Quest"). Made in the browser from the rendered image; nothing is uploaded.
## Product page interface translations (2026-11-15, ShanLe1224 / Claude)
- AI-generated translations: the Simplified Chinese, French and Japanese interface text in `src/ui/product/i18n/messages-zh.ts`, `messages-fr.ts` and `messages-ja.ts` was translated from the English file `messages-en.ts` by Claude (Anthropic) during development. Prompt in short: "translate every interface string, keep the {placeholders}, plain everyday words". **Not yet checked by a native speaker.** Tool tours, AI chat replies and detailed science notes are still in English.
- Mission simulator equipment presets (`src/ui/product/simulator/mission-presets.ts`) are illustrative, typical-order-of-magnitude values written with AI assistance. They are not the specification of any real mission, and the interface labels them as typical values.

## README animated mascot (2026-11-15, louis068 / Codex)
- `docs/assets/bean-drift-mascot.svg`: adapted the user's existing local Argon pixel-art SVG into three rotating scenes (astronaut, lander, satellite/rover). AI-assisted SVG code and short English scene captions; no external imagery added. Prompt: reduce crowding, show a few figures at a time, let them fly away and be replaced. Decorative illustration only, not mission telemetry or measured lunar terrain. Includes reduced-motion fallback.
- Follow-up: added three staggered decorative meteor trails and linked the banner to the explorer in both README languages. Browser image preview inspected; reduced-motion mode hides meteor motion. No new external assets.

## Product site flow and map display model (2026-11-15, ShanLe1224 / Codex)
- Temperature-model reference: Hurley et al. (2014), An analytic function of lunar surface temperature for exospheric modeling, DOI https://doi.org/10.1016/j.icarus.2014.08.043 ; open manuscript https://ntrs.nasa.gov/api/citations/20150010748/downloads/20150010748.pdf . The product adapts the published daytime fit, nighttime polynomial and effective 4.5-degree roughness with continuous dawn/dusk joins and radiance averaging. This is an adapted empirical estimate, not measured Diviner imagery or a full heat-conduction calculation; local accuracy is not inherited from the paper. Implementation and limitations: docs/decisions/2026-11-15_ShanLe1224_empirical-temperature-cycle.md.
- Map labels reuse the existing IAU Gazetteer / USGS 9,087-name catalog already credited above, with its names and coordinates unchanged. Visibility priorities, density/collision rules, grid rendering, site-selection UI and related English interface copy were implemented with OpenAI Codex assistance. Prompt summary: separate inspection from candidate comparison, keep candidates when finding another site, add four zoom-dependent grid levels and sparse official feature names. No AI-generated photographs or invented lunar coordinates were added.
