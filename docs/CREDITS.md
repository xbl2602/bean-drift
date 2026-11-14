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

## 2. 算法与代码来源

- 星历：自实现，截断的 Meeus 月球理论 + 低精度太阳 + IAU 月球自转模型；对照 JPL Horizons 校验（见 PROJECT_CONTEXT）。
- 渲染：three.js（MIT 许可）。
- 第三方 npm 包的许可，进入产品后由 `xbl2602` 汇总。

## 3. 图片 / 字体 / 音乐 / 模型 / 视频素材

> 每新增一项，登记：名称、文件位置、来源链接、许可、是否 AI 生成、（AI 生成的）提示词、登记人、日期。

| 名称 | 文件位置 | 来源/许可 | 是否 AI 生成 | 提示词 | 登记人 | 日期 |
|---|---|---|---|---|---|---|
| 主页缩略图 | `prototypes/lunar-scene-demo/thumbs/` | 我们自己场景的截图，无外部素材 | 否（场景由 AI 辅助编写的代码渲染） | — | xbl2602 | |

## 4. AI 辅助声明

- 本项目的代码和文档在 AI 辅助下完成（Claude 等 AI 编程工具）；使用 AI 生成的**图像、视频、音频、文案**需要在上表单独登记，并在最终视频/提交说明中标明。
- 地形、星历等科学内容以公开数据和对照校验为准，不以 AI 生成内容当作数据。

## 5. 预设点位坐标出处

> 预设着陆点的坐标**必须有出处**（官方文档/可靠数据库），不得凭记忆填写。

| 点位 | 坐标 | 出处链接 | 核对人 | 日期 |
|---|---|---|---|---|
| 阿波罗 11 号 | 0.67416°N 23.47314°E | 原型使用值，来自 LROC 影像中"鹰号"下降级位置（见 PROJECT_CONTEXT），误差几米 | xbl2602 | |
