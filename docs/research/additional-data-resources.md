# 补充调研：还有哪些可用的数据与资源

> 日期：2026-11-14。调研人：`xbl2602`（Claude Code 协助）。
> **状态：已实测大部分链接，条款/许可有几处没查到（第 3 节）。不是官方保证，别当成定论。**
>
> 标记说明：✅ = 我实际请求过并看到了结果；📄 = 只在页面或搜索摘要里读到，没实测；⚠️ = 没查到，或有疑点。

## 0. 先看结论

1. **最大发现：南北极的"平均太阳光照、永久阴影、平均地球可见性、天空可见度"已经有人预计算好了**（NASA LOLA 团队，覆盖 65°–90°，60/120/240 米/像素，按 18.6 年每小时一步平均）。我们的"断电/断信号统计图"和"综合有效位置图"可以拿它当现成图层，更重要的是当**校验答案**。第 2.A 节。
2. **Moon Trek 不只是底图。** 它还以瓦片形式提供极区的"平均地球可见性"、WAC 光照百分比、永久阴影，**全部带跨域许可，浏览器能直接读**；还有一个"按坐标查像素值"的接口可用。第 1.2 节。
3. **Horizons 可以直接当"月面观测者"用**（给月面任意经纬度，返回太阳/地球的方位角和高度角），我实测成功。这是现成的**星历测试答案**。第 1.3 节。
4. **QuickMap 是同类产品和校验工具，不是数据源**：没有公开接口，数据底层就是 PDS 数据。第 1.1 节。
5. **CSA 页面是背景资料，没有数据可用。** 而且我用工具抓你给的那个地址两次都被拒（`target_unreachable`），下面 CSA 的内容来自搜索摘要，不是页面本身。第 1.4 节。
6. **版权有个坑**：LROC 官网内容里，只有走 PDS 交付的数据是公共领域；官网展示的精选图、非 PDS 接口的内容**是有版权的**。第 3 节。

## 1. 你给的四个站点

### 1.1 LROC QuickMap
- 📄 功能：2D/3D、第一人称模式、3D 阴影（可选太阳或地球当光源）、对某位置做一段时间的"可见性分析"、"NAC 实拍光照"图层（显示当前 UTC 时刻的真实光照）、TerrainShadows 模拟器、2D 里可导入 COG（云优化 GeoTIFF）。（来源：ACT 官方博客 2023、2024 年更新说明）
- 📄 图层里有：极区光照图、地球/太阳可见性、Diviner 温度、Kaguya 矿物、Mini-RF 等。
- ⚠️ **没找到公开接口、批量下载接口、或 QuickMap 自己的使用条款。** 它背后的 `qts.quickmap.io/fcgi-bin/...` 是网页自己用的内部接口，没有文档，**别依赖**。
- **怎么用**：① 竞品参照（它已经有第一人称和可见性分析，评委可能见过）；② 目视校验：选同一个 UTC 时间，对比我们算的光照；③ 想要它的数据，去它背后的 PDS 源头拿（第 2 节）。

### 1.2 NASA Moon Trek（在 `nasa-trek-tiles-for-frontend.md` 基础上的补充）
- ✅ **图层目录是个公开 JSON 接口**（从 Trek 自己的配置文件里找到的）：
  `https://trek.nasa.gov/moon/TrekServices/ws/index/eq/searchItems?start=0&rows=2147483647&facetKeys=itemType%7CproductCat2%7CserviceTypes%7CthumbnailURLDir&facetValues=product%7C-%28DEM%20ConfidenceRaw%20Slope%29%7CMosaic%7C%5B%2A%20TO%20%2A%5D`
  （把 `eq` 换成 `polar` 得到极区图层。2026-11-14 实测：`eq` 1096 个图层，`polar` 490 个。）每个图层的瓦片地址再用 `.../getLayerServices?uuid=<item_UUID>` 取。
- ✅ 实测过、**带 `Access-Control-Allow-Origin: *`**（浏览器可直连）的图层：

| 图层名（Layer） | 内容 | 网格 | 备注 |
|---|---|---|---|
| `LRO_LOLA_Illumination_SPole65S_240m_EQ` | 南极 LOLA **永久阴影区**，240 m | 等距柱状（`/Moon/EQ/`），最高 z5 | **可直接叠在我们的 2D 全月图上**；只覆盖 -90° 到约 -55° |
| `LRO_LOLA_ClrShade_Global_256ppd_v06` | 全月 LOLA 彩色地形渲染，更新的 v06 | 等距柱状，最高 z6 | 比 v04 多一级。按公式算 z6 约 333 米/像素（我没逐块核对） |
| `LRO_LOLA_ClrSlope_Global_16ppd` | 全月坡度，彩色 | 等距柱状，最高 z2 | **太粗**（16 ppd ≈ 1.9 km/像素），只能做全局示意，选址没用 |
| `LRO_Diviner_ST_Avg_Clr_Global_32ppd` | 全月平均表面温度，彩色 | 等距柱状，最高 z3 | 只是示意 |
| `AVGVISIB_85S_060M_201608_EARTH_SP`（及 65S/75S 版） | **平均地球可见性**，60 m（240/120 m 版也有） | **南极立体投影**（`/Moon/SP/`） | 要自己处理投影，不能直接贴到等距柱状图上 |
| `WAC_POLE_ILL_PCT_SOUTH_100M`（及 `_TWI_` 时间加权版） | WAC 实拍统计出的"一年里有多少比例时间被照亮"，100 m | 南极立体投影 | 同上 |
| `ClrSKYV_65S_240M_SP` | 天空可见度，彩色 | 南极立体投影 | |

- ✅ **点查询接口**：Trek 的 ArcGIS ImageServer 支持 `identify`（按坐标读像素值），也带 CORS。例：
  `https://trek.nasa.gov/moon/trekarcgis2/rest/services/AVGVISIB_85S_060M_201608_EARTH_SP/ImageServer/identify?geometry={"x":0,"y":0,"spatialReference":{"wkid":0}}&geometryType=esriGeometryPoint&f=json`
  → 返回 `"value":"0.31492"`（南极点处的平均地球可见性，看起来是 0–1 的比例）。坐标是**极立体投影的米**，不是经纬度，调用前要先转换。
- ⚠️ **使用条款仍然没查到。** Trek 自己的"关于"页只有功能介绍，没有数据政策。沿用 `nasa-trek-tiles-for-frontend.md` 第 6 节的结论：能用，但要集中配置、要有降级、要镜像备份。

### 1.3 JPL Horizons
- ✅ **月面观测者可用。** 用 `CENTER='coord@301'`（301 = 月球）加 `COORD_TYPE='GEODETIC'` 和 `SITE_COORD='东经,纬度,海拔km'`。我实测：

```
GET https://ssd.jpl.nasa.gov/api/horizons.api
  ?format=text&COMMAND='10'&EPHEM_TYPE='OBSERVER'&MAKE_EPHEM='YES'&OBJ_DATA='NO'
  &CENTER='coord@301'&COORD_TYPE='GEODETIC'&SITE_COORD='0,-89.5,0'
  &START_TIME='2030-01-01 00:00'&STOP_TIME='2030-01-01 06:00'&STEP_SIZE='2 h'
  &QUANTITIES='4'&ANG_FORMAT='DEG'
```
  返回（太阳，经度 0°、纬度 -89.5°、海拔 0）：
  `2030-Jan-01 00:00  方位角 221.996462°  高度角 -0.801653°`；
  `02:00 → 220.981271 / -0.810041`；`04:00 → 219.966044 / -0.818309`；`06:00 → 218.950779 / -0.826454`。
  **这四行可以直接当我们星历代码的回归测试答案。** 把 `COMMAND` 换成 `'399'` 应该能取地球（我没测）。
- ✅ 关键事实：返回头里写明用的是 `MEAN_ME (high precision)` 月球自转模型、DE441 星历、月球半径 1737.4 km 的光滑球面。**所以它给的是"没有地形的地平线"**，正好当"不含地形"的基准线。
- ⚠️ 文档没写明确限速，只在错误码表里提到 503 = 服务器过载。**别在用户每次点击时去调它**，用来离线校验、生成测试数据。`jpl.nasa.gov` 的版权页我没读。
- 一个要核对的点：`CREDITS.md` 写你们的星历用的是"IAU 月球自转模型"，而 NAIF 的文档明确警告 `IAU_MOON` **不能用于高精度月球姿态**（应使用 DE440 的 `MOON_ME`/`MOON_PA`，两者本身差约 0.029° ≈ 875 m）。IAU 模型与 ME 差多少我没查到数字，建议用上面的测试答案实际比一下。

### 1.4 加拿大航天局（CSA）月球探索页
- ⚠️ 你给的地址和 `canada-role.asp` 我用 TinyFish 抓都是 `target_unreachable`（站点拒绝机器访问），所以**下面都来自搜索摘要，不是页面原文**。
- 📄 内容：Canadarm3（给 Gateway 的机械臂）、LEAP（月球探索加速计划）、月面实用车（2023 年预算承诺 12 亿加元 / 13 年）。
- 📄 **加拿大的首辆月球车**原定搭 Firefly 的 Blue Ghost 去 Haworth 环形山边缘（2029），搜索结果称已在 CSA 2026–27 部门计划里被取消（Space.com 等二手来源，**我没读到 CSA 原文**）。
- **结论**：没有数据集，没有可调用的接口。只可能用作视频/文案的背景，或预设点位的一条备注。**不进数据清单。**

## 2. 新找到的资源

### 2.A 预计算的光照 / 可见性（最有价值）

NASA PGDA 页面 https://pgda.gsfc.nasa.gov/products/69（Mazarico，LOLA 团队）。基于 LOLA 地形、1 小时一步、覆盖一个完整月球章动周期（约 18.6 年）。极立体投影，参考半径 1737.4 km。

| 产品 | 范围与分辨率 | 备注 |
|---|---|---|
| 平均太阳光照 `AVGVISIB_*` | 65°S/N 240 m、75° 120 m、85° 60 m | 南北极都有 |
| **平均地球可见性** `AVGVISIB_*_EARTH` | 同上 | 页面注明：圆盘**只要有一部分没被挡就算"可见"**，对只考虑 DSN 的链路"略偏乐观" |
| 永久阴影 `LPSR_*` | 同上 | |
| 天空可见度 `SKYV_*` | 65° 240 m | |

- ✅ **下载地址**：页面上 `pgda.gsfc.nasa.gov/data/MoonIllumination/*.TIF / *_COG.TIF` 的链接**现在全部 404**（2026-11-14 实测，服务器返回 HTML 错误页）。**可用的是 MIT `imbrium` 镜像的 JP2**（✅ 实测 200，支持范围请求，**没有 CORS 头**，所以由 `pipeline/` 下载，不要让浏览器直接读）：
  - `http://imbrium.mit.edu/EXTRAS/ILLUMINATION/JP2/AVGVISIB_85S_060M_201608_EARTH.JP2` — 21.6 MB
  - `.../AVGVISIB_65S_240M_201608_EARTH.JP2` — 21.8 MB
  - `.../AVGVISIB_65S_240M_201608.JP2`（太阳光照）— 48.6 MB
  - `.../LPSR_65S_240M_201608.JP2`（永久阴影）— 2.6 MB
  （其余文件名照页面上的模式换 `75S`、`85S`、`N` 即可，我没逐个验证。）
- **局限**：这些是 **18.6 年平均值**，不是"某一天某一刻"，**只能校验时间轴结果的平均水平，不能替代我们的时间轴计算**。另外只覆盖 ±65° 以上的极区，全月其他地方没有。
- 📄 另有 LROC 的 WAC 极区光照图（实拍统计，100 m）：`WAC_POLE_ILL_PCT_SOUTH`、`WAC_POLE_ILL_TWI_SOUTH`，在 https://data.lroc.im-ldi.com/lroc/view_rdr/WAC_POLE_ILL_PCT_SOUTH 。这是 PDS 数据，见第 3 节的条款。

### 2.B 地形 / 坡度

| 资源 | 用途 | 状态 |
|---|---|---|
| PGDA 产品 104：南极"形状从明暗"增强 DEM，5 m/像素 | 比 LOLA 更细的选址级地形 | 📄 覆盖的是 2022 年**最初 13 个**阿尔忒弥斯 III 候选区；NASA 2024-10 把它缩成 **9 个**（Peak near Cabeus B、Haworth、Malapert Massif、Mons Mouton、Mons Mouton Plateau、Nobile Rim 1、Nobile Rim 2、de Gerlache Rim 2、Slater Plain）。9 个是不是 13 个的子集我没核实 |
| USGS 阿尔忒弥斯 III 9 个候选区的 LGRS 导航网格（1 km/100 m/10 m），2024-12-05 发布 | 给候选区定网格坐标 | 📄 https://www.usgs.gov/data/down-selected-artemis-iii-candidate-landing-site-navigational-grids |
| LROC NAC 各候选区拼图（如 `NAC_ROI_MALAPERTLOB`） | 第一人称/落区细节的画面 | 📄 https://data.lroc.im-ldi.com/lroc/view_rdr/ 下，PDS |
| NASA SVS 4720 "CGI Moon Kit" | 3D 渲染用的月面颜色图和位移图（64/16/4 ppd） | ✅ 页面确认：免费，要求署名 "NASA's Scientific Visualization Studio"；**美观优先，页面明说科学用途应使用源数据** |
| SLDEM2015 衍生的坡度/方位（PGDA 产品 67） | 全月坡度，比 Trek 的 16 ppd 细 | 📄 只见于搜索摘要，没打开 |
| Cesium ion "Cesium Moon Terrain"（资源 ID 2684829） | 现成 3D Tiles 月面 | 📄 **不建议**：要 Cesium 账号，和我们的 three.js 技术栈不一致，社区有人报它比 LOLA 高约 2.5 km 且未见回答 |
| USGS 月球 WMS（`planetarymaps.usgs.gov`） | 另一个瓦片来源 | ⚠️ 搜索摘要称该服务部分已退役，**不建议依赖** |

### 2.C 星历、校验与计算工具

| 资源 | 用途 | 状态 |
|---|---|---|
| NASA SVS 5587 "Moon Phase and Libration 2026" 逐小时表 | 校验**日下点（Slon/Slat）和地下点（Elon/Elat）** | ✅ `https://svs.gsfc.nasa.gov/vis/a000000/a005500/a005587/mooninfo_2026.txt`，1.0 MB 纯文本，逐小时。表头：`Phase Age Diam Dist RA Dec Slon Slat Elon Elat AxisA`。⚠️ 只覆盖 2026 年（2025 另有一份，SVS 5415） |
| NAIF 通用内核（SPICE） | 高精度月球姿态 | ✅ 文件都存在：`de440s.bsp` 32.7 MB、`moon_pa_de440_200625.bpc` 12.9 MB、`moon_de440_250416.tf` 19 KB、`naif0012.tls`（闰秒）5 KB。⚠️ NAIF **没有 CORS 头**，浏览器不能直接读，需要自己托管。**不建议进浏览器**，用在 `pipeline/`（SpiceyPy）更合适 |
| `timecraftjs`（NASA-AMMOS） | CSPICE 编译成 WebAssembly，浏览器里读 SPICE 内核 | 📄 偏时间转换；最近一次推送 2024-01；Webpack 有坑（会 `require('fs')`）。48 小时内**不值得引入** |
| Horizons | 见 1.3 | ✅ |

### 2.D 通信（补上 `lunar-landing-site-navigator_research.md` 第 8 节"没查到判据"）

- ✅ **JPL（Bryant 2009/2010，NTRS 20150014706、20150008843）**：用雷达 DEM（40 m，约 5 m 相对垂直精度）把地形转成地平线遮罩，再与"太阳和地球相对月球的最大运动范围"比较。结论：**南极最佳基地候选点，全年太阳能可用率约 92%，直连地球（DTE）可用率约 50%。**（摘要明写。注意：这是 2006 年雷达 DEM 的老结果。）
- 📄 同一批 JPL/Purdue 文献的搜索摘要称：**南极的天线要指向地球的仰角约在 2°–10°**（几何限制）。这条只来自摘要，**请读原文确认再引用**。
- 📄 **自己推的验证**（不是来源结论）：SVS 表里 2026-01-01 的地下点纬度 `Elat` ≈ -6.56°。南极点看地球的高度角 ≈ |Elat|，所以约 6.5° 上下摆动，和"仰角几度"的说法一致。
- ⚠️ **仍然没找到**"直连要求的最小仰角"这种**统一的工程阈值**。它取决于具体任务的天线，原文说"见任务自己的通信需求文件"。**建议：把最小仰角做成用户可调参数，默认值标明是假设。**
- 📄 DSN：三个站（Goldstone、马德里、堪培拉）。NAIF 提供站点坐标内核（`earth_topo_*.tf`、`earthstns_*.bsp`）。⚠️ 我试的 `earthstns_itrf93_201023.bsp` 已 404（已被新版取代），要去目录里找最新的。DSN Now 实时数据源地址**没查到**，不依赖它。
- 💡 候选图层（不是已定的）："Earth 可见 **且** DSN 至少一个站能看到月球"。需要站点坐标 + 地球自转。要不要做，先议。

### 2.E 着陆点坐标与地名

| 资源 | 用途 | 状态 |
|---|---|---|
| LROC《2016 Coordinates of Human Features》 | 阿波罗、Surveyor、Luna、嫦娥等**以 LROC 影像受控定位**的坐标 | 📄 https://www.lroc.asu.edu/data/support/downloads/2016_LROC_Coordinates_of_Human_Features.pdf |
| NSSDCA 阿波罗着陆点坐标 | 阿波罗系列 | 📄 https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html ，注明用 MEAN_ME 坐标系、DE421 |
| NSSDCA 近期着陆器表 | 嫦娥 4/5、Chandrayaan-3（≈69.3741°S 32.32°E）、SLIM（≈13.3160°S 25.2510°E）、IM-1、Blue Ghost 1 | 📄 页面承认"部分近似" |
| **USGS/IAU 月球地名库** | 做"搜索框 → 跳转到 Shackleton"这类功能 | ✅ `https://asc-planetarynames-data.s3.us-west-2.amazonaws.com/MOON_nomenclature_center_pts.zip`，23.8 MB（含 KMZ）。页面写明**坐标只保证 2 位小数**（≈300 m），边界多边形仅供定位名称用，不是精确地质边界 |
| CLPS 近况（2026-10 的二手来源） | 预设点位 | 📄 **Griffin-1**：仍计划 2026 年底发射，站点在 Mons Mouton 一带（某追踪站给 84.6°S 31.0°E，**是特征坐标，具体落点还没公布**）。**Blue Moon MK1、IM-3、Blue Ghost 2 均已推到 2027**。**日期变化快，别把日期写成事实**；按 `CREDITS.md` 第 5 节要求每个坐标都要有出处 |

### 2.F 视觉素材
- ✅ NASA SVS 4851 "Deep Star Maps 2020"：星空贴图，4k 到 64k（4k 的 EXR 34 MB，16k 的 423 MB）。**是 OpenEXR 半精度，浏览器要先转成 JPG/PNG**。署名要求：`NASA/Goddard Space Flight Center Scientific Visualization Studio. Gaia DR2: ESA/Gaia/DPAC.` 用在第一人称视角的天空背景合适。
- 📄 NASA 图像库、NASA 3D 资源（着陆器模型等）可用于 landing page；用之前读 NASA 媒体使用规范（见第 3 节）。

## 3. 版权与条款（需要你定怎么处理）

1. **LROC 的条款要分两种**（✅ 读了 https://lroc.im-ldi.com/about/terms ）：
   - 走 LROC 数据节点 / NASA PDS 交付的数据产品：**公共领域**。
   - LROC 官网上的"精选图像、精选站点、整理过的下载、非 PDS 接口"：**有版权**。教育用途无需事先许可、但必须署名 `NASA/GSFC/Arizona State University`；**商业用途要事先许可**。
   - 这对我们的影响：Lunaserv（LROC 的 WMS 服务）和 QuickMap 属不属于"非 PDS 接口"，页面没说清，**我判断不了**。**稳妥做法：产品里只用 PDS 来的原始数据文件；视频里如果用了 QuickMap 截图，必须署名，并先问一下。** 这条和比赛的"不能用有版权素材"直接相关。
2. **Moon Trek 的使用条款**：仍然没查到（见 1.2）。已在 `CREDITS.md` 标了"条款未确认"。
3. **NASA 媒体使用规范**（📄 搜索摘要）：NASA 内容一般不受美国版权保护；NASA 徽标不是公共领域，不要用；有人物的图或第三方合作方的图可能有不同限制；**规范里写着：AI 生成的内容要署名给 AI 产品，不能写成"据 NASA"这类说法**——我们的 agent 窗口输出要注意措辞。
4. 新增的数据源按规则要登记 `CREDITS.md`。**我这次只是调研，没有改 `CREDITS.md`**——真正接入哪一个，再登记。PGDA 页面要求使用 LOLA 光照图时**引用 Mazarico et al. (2011), Icarus 211, 1066–1081, doi:10.1016/j.icarus.2010.10.030**。

## 4. 与现有文档的出入（需要你决定，我没有擅自改）

1. `nasa-trek-tiles-for-frontend.md` 第 2 节表里 LOLA 一行写"约 666 米/像素"。**666 m 是瓦片最高级别 z5 的分辨率，不是图层本身的分辨率**（LOLA 128 ppd 本身约 237 m/像素）。另有更新的 `LRO_LOLA_ClrShade_Global_256ppd_v06`（z6）。
2. 同文件第 6 节第 4 点说"极区图层没研究"。现在有结论了：见 1.2 的表。
3. `lunar-landing-site-navigator_research.md` 第 8 节说"直连地球的判据没查到" —— 本次找到部分定量依据（2.D），但**仍没有统一的最小仰角阈值**。
4. `CREDITS.md` 对 JPL Horizons 的说明是"仅用于校验我们自实现的星历"。这次实测它能直接给月面观测者的太阳方位/高度，**用法可以更具体**（回归测试答案）。
5. PGDA 的 `products/69` 页面上的 TIF/COG 直链当前 404，**请别照页面写的地址写进 `pipeline/`**，用 MIT 镜像的 JP2。

## 5. 建议怎么用（按优先级，不是已定）

| 优先级 | 做什么 | 理由 |
|---|---|---|
| **P0** | 用 Horizons 取一批月面观测者的太阳/地球方位高度（几个典型点 × 几个日期），存成测试数据；再用 SVS `mooninfo_2026.txt` 校验日下点/地下点 | 便宜、一次性、能给"星历可信"提供证据，视频里也能说"用 NASA 数据校验" |
| **P0** | 在 `pipeline/` 下载 MIT 镜像的极区平均太阳光照/地球可见性/永久阴影 JP2，当**对照答案**（我们的时间轴结果取长期平均后，应与它大致吻合） | 这是"断电/断信号"图层最直接的参照 |
| **P1** | 前端把 `LRO_LOLA_Illumination_SPole65S_240m_EQ`（永久阴影）作为可叠加图层试一下（等距柱状，不用重投影） | 免做、有 CORS、立刻有极区观感；注意降级与条款未确认 |
| **P1** | Trek `identify` 用来快速取"某点的平均地球可见性"作为 agent 或兜底 | 要先写极立体投影转换 |
| **P2** | IAU 地名库做搜索跳转；Deep Star Maps 做第一人称天空；CGI Moon Kit 做 landing page 的月球贴图 | 都是锦上添花，注意署名 |
| **P3** | SPICE 内核 + SpiceyPy 进 `pipeline/` 提升星历精度；DSN 可见性图层 | 只有时间富余再做 |
| 不建议 | QuickMap 内部接口、USGS WMS、Cesium Moon、CSA | 见上各节 |

## 6. 这次没做到的

- CSA 页面原文没读到（被拒绝），内容来自搜索摘要。
- Moon Trek、LROC Lunaserv 的**使用条款**没查到；JPL 版权页、NASA 媒体规范原文没逐字读。
- 没有**对照我们自己的星历代码**去跑 Horizons 的测试答案（只是取到了答案）。
- 没下载任何大文件，也没验证 JP2 内容、投影参数、数值含义（例如 `AVGVISIB` 的 0–1 是否是时间比例）。
- 没有核实 Artemis III 9 个区的官方坐标，也没有核实 13→9 的包含关系。
- 搜索工具只面向美国，部分来源（尤其二手新闻）可能不全；2026 年 10 月之后的 CLPS 进展没有继续追。
