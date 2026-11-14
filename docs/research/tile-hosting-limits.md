# 调研：高精度月面数据放哪、会不会触发限制

> 调研人：`xbl2602`（Claude Code 协助）。对应待决问题：`docs/TODO.md` 的 Q4（预计算产物放哪）、Q5（用什么 DEM、多大分辨率）。
> **状态：调研结果，不是决定。** 各平台的额度和价格会变，下面数字来自官方文档页面，选定前请再核对一次。

## 1. 数据到底多大

- LOLA 全月 118 m/像素（`LDEM_256`）：USGS 页面写单个全球 GeoTIFF 约 **8 GB**；MIT 镜像里分 4 块，每块约 2.12 GB，合计约 **8.5 GB**。16 位整数。
- **压缩后多大没测过**，需要用真实数据实测。
- 用户不会下载这么多：数据切成小块，只取当前画面需要的几块（见第 4 节）。

## 2. 各平台的限制（官方文档）

| 平台 | 关键限制 | 放 8.5 GB？ |
|---|---|---|
| **Vercel 静态部署** | 命令行部署时 Hobby 源文件上限 **100 MB**；Hobby 每月 **100 GB** 流量；Hobby 仅限非商用 | ❌ |
| **Vercel Blob** | Hobby 存储 **1 GB**、流量 10 GB；超限不收费但**被禁用 30 天**；单个文件超过 **512 MB** 不进缓存（每次访问都回源并计费） | ❌ |
| **Supabase 免费版** | 存储 **1 GB**、流量 5 GB、单文件 **50 MB**；一周不活跃项目被暂停 | ❌ |
| **Supabase Pro** | 存储 100 GB、流量 250 GB；超出流量 $0.09/GB | 可以，但要付费 |
| **Cloudflare R2** | 免费存储 **10 GB**；每月 100 万次写类、1000 万次读类操作；**下载流量免费**；超出存储 $0.015/GB/月 | ✅ 勉强（压缩后宽裕） |
| **GitHub 仓库** | 本项目规则：单文件超过 50 MB 不进 git | ❌ |
| **Oracle 免费 VPS** | 块存储共 **200 GB**；出站流量 **10 TB/月**；Arm 机型整个免费租户 **2 个 OCPU + 12 GB 内存**（不是旧政策的 4 核 24 GB）；AMD 小机型 1 GB 内存、最高 50 Mbps | ✅ 放得下，但见第 3 节 |

## 3. Oracle 免费 VPS 的风险

1. **空闲回收**：连续 7 天内 CPU 和网络（Arm 机型还有内存）用量的 95 分位都低于 20%，机器可能被回收。静态文件服务正是这种低负载。
2. **单点故障**：就一台机器。`docs/DATA_FLOW.md` 要求演示用数据要能脱离 VPS 访问。
3. **必须有 HTTPS**：Vercel 页面是 https，浏览器会拦截它去读 http 的服务器（混合内容）。需要域名和证书，或前面套 Cloudflare。（浏览器通用规则，未在文档里逐条核对。）
4. **跨域配置**：要允许 `Range` 头和跨域，否则 PMTiles 读不了。
5. **算力弱**：2 核，不适合做重计算。重计算仍放 `xbl2602` 的电脑（D-0006）。
6. **机房位置未知**：用户和评委在马来西亚时，离得远会增加每块的延迟。

## 4. 建议的存放方式（候选，未决）

- **切成瓦片金字塔**：同一份地形存多个精度级别，每级切成 256×256 的小块。远看用粗的，拉近换细的。
- **打包成单个大文件加索引（PMTiles）**：浏览器用 HTTP 范围请求只取需要的字节，不用管几万个小文件。Protomaps 官方文档把 R2 列为首选托管，原因是没有流量费、只按请求次数计费。PMTiles 的官方客户端是给 MapLibre 用的，**用 three.js 需要自己用它的 JS 库读字节再解码**。
- **分工**：
  - Oracle VPS：完整的全精度数据和预处理产物备份。
  - Cloudflare R2：对外演示实际用的那一份（比赛时前端只读它）。
  - 两处互为备份，丢一处不丢数据。
- **图层很小**：坡度图、日照图、通信图是约 0.5–1 km 精度的统计图，估算几十 MB 以内，可以跟网站一起放，不需要为它们上 VPS。
- **日照随时间轴变化不要逐时刻预渲染**（会有几万张）。更现实的做法：预先算好每个位置的"地平线轮廓"，网页里用星历实时判断当前亮还是暗。这个方案**未验证**，且依赖 Q1、Q2 的指标公式。

## 5. 每个用户大约下多少（估算，没实测）

按每块 256×256、每点 2 字节、未压缩约 128 KB：

| 场景 | 要取什么 | 约 |
|---|---|---|
| 打开 2D 全月图 | 一张低精度总览加当前屏幕里几块 | 十几 MB 以内 |
| 点一个位置看参数 | 附近一两块 | 零点几 MB |
| 第一人称 | 脚下约 3×3 块，加远处低精度块 | 几 MB 到十几 MB |

## 6. 还没查 / 没验证

- GitHub LFS、Backblaze B2、Netlify 等其他平台。
- 压缩比：16 位地形无损压缩能到多小，要实测。
- R2 是否可以不绑信用卡使用（没查到）。
- Oracle 对象存储的当前免费额度（官方页面写 10 GB 或 20 GB，不同状态下不同，没完全确认）。
- 一次典型会话取多少块，决定 R2 的读取次数够不够。
- 其他现成的月球 16 位地形瓦片：LROC QuickMap、USGS 月球瓦片服务、Cesium 月球地形，**没有验证**。

## 7. 来源

- Vercel：https://vercel.com/docs/limits 、https://vercel.com/docs/limits/fair-use-guidelines 、https://vercel.com/docs/vercel-blob/usage-and-pricing
- Supabase：https://supabase.com/pricing 、https://supabase.com/docs/guides/storage/uploads/file-limits
- Cloudflare R2：https://developers.cloudflare.com/r2/pricing/
- Oracle：https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm
- Protomaps PMTiles：https://docs.protomaps.com/pmtiles/cloud-storage
- LOLA 118 m：https://astrogeology.usgs.gov/search/map/moon_lro_lola_dem_118m 、https://imbrium.mit.edu/DATA/LOLA_GDR/CYLINDRICAL/IMG
- NASA Moon Trek：https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=moon
