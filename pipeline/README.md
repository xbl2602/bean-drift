# pipeline/：整月预计算

把 NASA LOLA 全月高度图，算成"整个月面每个 0.25° 格子"的地形、地形遮挡和一整年的日照/对地可见统计，写成静态文件放进 `public/data/v1/`，随网站一起发布。**只有 `xbl2602` 改这个目录**（见 AGENTS.md 第 2 节）。决定背景见 [docs/decisions/2026-11-14_xbl2602_precomputed-terrain-and-year-stats.md](../docs/decisions/2026-11-14_xbl2602_precomputed-terrain-and-year-stats.md)。

## 怎么跑

1. 下载原始数据（一次，约 506 MB，不进 git）：
   https://imbrium.mit.edu/DATA/LOLA_GDR/CYLINDRICAL/IMG/LDEM_64.IMG
   存成 `data/raw/lola-global/ldem_64.img`（文件名小写；`data/raw/` 已被 git 忽略）。文件大小必须是 530841600 字节，脚本会检查。
2. 在仓库根目录：`npm run data`。数据放在别处时用环境变量指定目录，例如 `LOLA_RAW_DIR=D:/somewhere/lola-global npm run data`。
3. 需要 Node 24（脚本直接 import `src/core/ephemeris/ephemeris.ts`，用 Node 的类型剥离，不用编译）。
4. 在 `xbl2602` 的 20 线程电脑上整条流水线约 70 秒（地形 5 秒、地平线 25 秒、一年统计 40 秒）。内存：地形一步实测峰值约 1.1 GB（整个 DEM 读进内存）；地平线和一年统计两步没有单独量过。线程少的电脑会按比例变慢。

只想重跑某一步：`node --no-warnings pipeline/build-terrain.mjs`（以及 `build-horizon.mjs`、`build-stats.mjs`；后一步需要前一步的产物）。

## 步骤与产物（`public/data/v1/`）

| 步骤 | 脚本 | 产物 | 大小 |
|---|---|---|---|
| 1 地形 | `build-terrain.mjs` | `height-4ppd.i16`、`slope-4ppd.u16`、`aspect-4ppd.u16` | 各 2 MB |
| 2 地平线 | `build-horizon.mjs` + `horizon-worker.mjs` | `horizon-4ppd.u8`（32 个方位 + 1 层绕回） | 34 MB |
| 3 一年统计 | `build-stats.mjs` + `stats-worker.mjs` | `stats-4ppd.u16`（7 个平面） | 14.5 MB |
| 汇总 | `build-all.mjs` | `manifest.json`：版本、来源、参数、每个文件的格式和缩放系数、局限 | 几 KB |

**文件格式、每个平面的含义和缩放系数，以 `manifest.json` 为准**，接口层面的说明在 [docs/SHARED_INTERFACES.md](../docs/SHARED_INTERFACES.md) 2.5.1。共同约定：1440 列 × 720 行，行主序，小端；第 0 行 = 北纬 90°，第 0 列 = 经度 −180°；每格 0.25°。

`lib/lola-dem.mjs` 放共用的东西：读 DEM（并把经度从 0..360 转成 −180..180）、双线性取高度、网格常数。

## 方法要点（改参数前先读）

- **地形**：每格 16×16 个 DEM 像素取平均高度；坡度是逐像素坡度（约 474 m 基线）的平均。越靠近极点，东西向像素越短，基线按 1/cos(纬度) 加宽，保持约 474 m。
- **地平线**：从格子中心出发，沿 32 个方位射线推进（0.5 km 起，到 300 km 止，共 97 个采样点，越远越稀），在**球形月球**上算每一步的仰角 `atan2(r2·cosθ − r1, r2·sinθ)`，取最大值，编码成字节（−8°~32°，约 0.16° 一级）。**射线只从格子中心出发**，格子内部的地形不参与。
- **一年统计**：2030-01-01 起 8760 个小时；太阳和地球的位置来自 `src/core/ephemeris`（和 API 同一份星历）；地球视差用"地球位置减观察点"处理。**"可见" = 圆盘上缘高于地平线**，地平线取圆盘中心方位上、相邻两个方位线性插值的值；开头结尾被截断的时段按截断后的长度计。
- 多线程：Node `worker_threads` + `SharedArrayBuffer`，线程数 = CPU 核数 − 2。

## 已知局限（也写在 manifest.json 的 `limitations` 里）

- 0.25°（约 7.6 km）一格，是整月概览，不是着陆点尺度。
- 地平线只用 32 个方位、从格子中心算；两个方位之间的窄山脊会漏。
- 只有 2030 一年；月球轨道有 18.6 年周期，极区的最坏年份不是 2030。
- 星历约 0.02° 精度，不是任务级。
- **还没有对照 NASA 官方的 LOLA 平均可见性产品逐点核对**。目前做过的只有：格子中心的预计算值与运行时现算值一致（占比差 <0.05%，最长时段完全相同）；几个已知地点的合理性检查（阿波罗 11 号日照约 49%、最长黑夜 354 小时；背面地球可见 0%；南极日照约 28%）。

## 数据来源与许可

LRO/LOLA 全月 DEM `LDEM_64`（Smith et al. 2010, Space Sci. Rev. 150, 209–241），NASA PDS 地球科学节点；NASA 公开数据。登记在 [docs/CREDITS.md](../docs/CREDITS.md)。

## 完全卸载

删除 `public/data/v1/` 即可（API 会降级成"地形数据不可用"，不会报错）；`data/raw/` 里的原始文件可随时删。没有安装任何全局东西，没有写 `public/data/v1/` 以外的位置。

## 星历对照数据（不属于整月预计算）

`fetch-horizons-lunar-surface.py`：向 NASA JPL Horizons 抓 8 个月面观测点 × 14 个时刻（2005–2090 年）的太阳和地球方位角/高度角，存成 `src/core/ephemeris/tests/horizons-lunar-surface.json`。自动测试 `ephemeris-vs-horizons.test.cjs` 拿它和我们的星历比，偏差超过 0.02° 就报错（实测最大 0.013°）。

重新抓取：`python pipeline/fetch-horizons-lunar-surface.py src/core/ephemeris/tests/horizons-lunar-surface.json`（需要联网，约 1~2 分钟；Horizons 会按时间顺序返回，脚本会逐行核对时间戳）。平时不用重抓，参考值是固定的。
