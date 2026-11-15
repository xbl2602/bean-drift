# NASA Space Apps Challenge:Lunar Landing Site Navigator 赛前调研

选题:Lunar Landing Site Navigator(旧称 "CLPS Lunar Mission Browser")
状态:资料调研(本文件本身不含项目代码)

---

## 1. 规则(最重要)

官方 FAQ 原文:"Teams are not allowed to begin working on the challenges prior to the hackathon."
来源:https://www.spaceappschallenge.org/resources/participant-faqs/

- 可以:读文档、读论文、选题、组队、分工、讨论方案
- 不要:写项目代码、预处理数据、搭仓库骨架
- 边界不清的地方(例如学习性小实验)→ 问所在场地的 Local Lead
- 使用 AI(官方称 SI)允许,但提交时必须说明用法

### 参赛条款(Terms & Conditions)已读要点
来源:https://www.spaceappschallenge.org/legal/ (我读了"提交、知识产权、第三方材料"几节;全文未逐字通读)

- **开源**:原创内容必须"无限制免费可用"或以 OSI 认可的开源协议授权;不指定协议时,NASA 按 Apache 2.0 发布
- **第三方材料**(非 NASA 或合作机构的数据、代码):必须是公开免费可用,或至少是 OSI 开源协议;**授权信息必须写进提交文档**,否则 NASA 不接受也不发布
- **必须引用所有用到的来源**,即使是开源或免费的;不引用的,NASA 可撤销提名、奖项或优胜资格
- 不得包含不拥有版权的内容、出口管制信息(ITAR/EAR)、个人身份信息;未满 18 岁者的姓名、声音、肖像不得出现在提交里
- 条款中关于"赛前工作"的限制我没在已读部分找到,**该规定目前只见于 FAQ**
- 另有一条:NASA 政策限制与中国(含港澳)及中资实体相关的参与,按隶属关系而非国籍判断。组队前请对照条款原文

## 2. 赛事阶段(官方 FAQ;具体日期以官方最新公告为准,这里不记录)

按先后顺序:报名开放 → 挑战摘要公布、组队开放 → 挑战说明(完整要求)公布 → Space Apps Connect 开放 → 挑战资源(数据)、提交指南、评审指南发布 → **黑客松(48 小时),正式动工** → 全球提名、入围、荣誉提及公布 → 全球优胜者公布。

队伍规则:每队最多 6 人;只能加入一队、做一个挑战;Universal Event(线上)队伍至少 2 人才有资格参加全球评审;本地场地队伍至少 1 人。

## 3. 题目要点(官方原文摘要)

来源:https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/
难度标签:Advanced / Intermediate

- 问题:月球南极任务面临极端光照和通信限制;现有计算太阳、地球位置的工具界面复杂,难以高效评估
- 任务:做一个直观的工具或应用,让任务规划者、教育者、公众能快速对比着陆点和日期,可视化太阳和地球相对地平线的位置,评估发电潜力和直连地球通信窗口
- 题面建议(均为"可以考虑",非硬性):
  - 可选着陆点列表(阿波罗、CLPS 目标、他国计划)+ 自定义坐标;并排或依次对比
  - 日期时间可调,探索不同月昼、季节
  - 太阳和地球相对地平线的位置;距日落、地球落下的剩余时间
  - 指标:太阳高度角(影响发电效率)、日照时长、地球可见窗口
  - 2D 地图、3D 地表等多种可视化
  - 动画或时间线展示一个月昼内的变化
  - 兼顾专业规划者与大众

## 4. GitHub 上有没有类似项目

**结论:没找到成熟的开源同类工具;只找到一个直接撞题的线索,且无法验证内容。**

### 4.1 LunaHorizon(撞题线索,未验证)
- 地址:https://github.com/samuelakosaonyejekwe/lunahorizon
- 搜索摘要:"LunaHorizon: CLPS Lunar Mission Browser (NASA Space Apps 2026). Compare lunar landing sites and dates: Sun and Earth over real LOLA terrain horizons, solar …"
- 另一摘要:"LunaHorizon lets mission planners, educators and the public compare landing sites and dates in seconds. It shows where the Sun and Earth sit relative to the …"
- 另一条搜索摘要:"Compare lunar landing sites and dates: Sun and Earth over real LOLA terrain horizons, solar power and direct-to-Earth windows."
- **仓库页面、`raw.githubusercontent.com` 的 main 和 master 分支 README 均返回 404**
- 作者主页(`github.com/samuelakosaonyejekwe`)公开可见的"Popular repositories"只有 6 个与云运维、PHP、Python 练习相关的仓库,**没有 lunahorizon**。主页只列热门仓库,所以这不能证明它不存在,只能说明目前对外不可见(已删除、私有或改名)
- 因此内容、技术栈、许可证、提交日期**全部未核实**;已无进一步可行的抓取途径(不尝试绕过访问限制)
- 摘要显示其思路是"基于真实 LOLA 地形的地平线"
- 不清楚它是否在黑客松开始前就已存在;这是否符合规则不是我们的问题,但说明同题有人在公开做
- 建议:只看思路,不参考代码

### 4.2 相关但不撞题
| 项目 | 说明 |
|---|---|
| ChadOhman/artemis-tracker | Artemis II 实时任务仪表盘,用 JPL Horizons 星历、DSN 地面站可见性;可参考架构和 UI |
| prstoetzer/OrbitDeck | 桌面卫星跟踪,含地球站点的日月方位角 |
| kvsankar/chandrayaan-mission-design | 交互式 3D 轨道设计教学 |
| mourner/suncalc | 太阳位置库,仅支持地球 |
| AshfordeOU/kshana | 月球南极 PNT 导航仿真,与本题关系较远 |

### 4.3 计算底座(库)
- **Skyfield**:1.16 起支持月面经纬度;但月面日出日落需自己基于 almanac 逻辑编写。来源:https://github.com/skyfielders/python-skyfield/issues/258
- **SpiceyPy**(NASA SPICE 的 Python 封装):https://github.com/andrewannex/SpiceyPy
- **spicedmoon**(已通过 PyPI 的 JSON 接口核实):基于 SPICE/SpiceyPy 的 Python 工具包,协议 **LGPL-3.0**(OSI 认可),状态 Alpha(Development Status 3);作者为西班牙研究团队;说明里写明支持"地球或月球上的任意观测者位置",提供选月坐标、日-月-观测者几何、方位角和天顶角。**定位偏向"从地球观测月球"的辐照度研究**;它是否直接给出"月面站点看到的太阳和地球高度角",我没验证

### 4.4 相关研究与同类产品(强相关,值得读)
| 来源 | 要点 |
|---|---|
| **LunarRF**,arXiv 2610.34554v2(WPI;投稿 IEEE,预印本)https://arxiv.org/html/2610.34554v2 | 基于轨道修正的 LOLA 高程模型,覆盖南纬 80° 以南,20 m 网格;11,827 个候选桅杆点,逐点计算视域(viewshed)和 ITU-R P.1812 传播;摘要称"**没有公开产品**展示南极哪些位置在物理上能建立此类链路"。与本题的关系:解决的是地面蜂窝通信覆盖,不是直连地球,但方法(DEM→视域)相通 |
| Bryant 等,Lunar Pole Illumination and Communications Maps,NASA NTRS 20150014706(IPN Progress Report,2009)https://ntrs.nasa.gov/citations/20150014706 | 摘要:用 DEM 计算南极 100 km 范围内的平均太阳光照和地球可见性;**正是本题所需的两个量**,可作为方法参照。页面全文我没读到,只有摘要 |
| Artemis III 候选着陆点评估,arXiv 2406.19863 https://arxiv.org/html/2406.19863v2 | 综合地形、光照、矿物数据评估 1247 个满足 HLS 要求的位置;未读全文 |
| AGU JGR Planets 2026,"Assessing Potential Landing Sites With Favorable Illumination…"(doi 10.1029/2025JE009434) | 页面被拦截(bot_blocked),未读;我没有尝试绕过 |
| Barker 等 2021,Improved LOLA elevation maps for south pole landing sites | 高分辨率 DEM 与误差估计及其对光照的影响 |
| Zhang 等 2023,MDPI Remote Sensing 15(24):5691 | 基于多时相高分辨率图像的 Chang'E-7 光照分析 |
| NASA SVS 5228 | Ernie Wright 的南极太阳与地球动画 |

**判断(推断)**:LunarRF 作者称无公开产品展示南极通信可行性,与我的搜索一致;说明"面向公众的对比工具"在公开领域确实稀缺,但这不等于没人做。

## 5. 竞争情况(官方"找队伍"页)

> **2026-11-14 更新：本节和 4.1 的说法已过期。** 实际本题有 1049 支队伍，GitHub 上约 120 个公开同题仓库，其中几个已有线上站和几百次提交。最新情况见 [2026-11-14_competitor-landscape.md](2026-11-14_competitor-landscape.md)。下面保留的是赛前的原始记录。

官方"找队伍"页上至少有两支队选了本题(队伍和个人信息不记录在这里):一支在做太阳能和直连地球通信窗口模型,一支在可视化太阳和地球轨迹。两支队都沿用旧题名 "CLPS Lunar Mission Browser"。另有一个黑客松网站也列出过该挑战,页面抓取时 404。

## 6. 数据与资料(仅阅读)

官方挑战资源 11/13 才发布,以下为公开资料:

- 地形:USGS Astropedia LOLA DEM 118 m — https://astrogeology.usgs.gov/search/map/moon_lro_lola_dem_118m
- 地形:SLDEM2015 — https://pgda.gsfc.nasa.gov/products/54
- 地形:南极高优先级着陆点高分辨率 LOLA DEM — https://pgda.gsfc.nasa.gov/products/78
- PDS LOLA 数据:https://pds-geosciences.wustl.edu/missions/lro/lola.htm
- 光照:LROC 极区光照图 — https://lroc.im-ldi.com/images/downloads
- 月球南极图集(LPI):https://www.lpi.usra.edu/lunar/lunar-south-pole-atlas/
- 现象参照:NASA SVS 5228(太阳贴着地平线转,上下不超过几度;地球在地平线附近上下摆动)— https://svs.gsfc.nasa.gov/5228
- 方法论文:Chang'E-7 南极光照分析(MDPI Remote Sensing 15(24):5691)— https://www.mdpi.com/2072-4292/15/24/5691
- Artemis III 13 个南极候选着陆区(背景):来源为二手报道,未核实

## 7. 推断(非来源结论,供讨论)

1. 南极太阳高度角始终很低,只算星历会严重失真,**地形遮挡**是关键
2. 题面强调"现有工具界面复杂",交互简洁和对比直观可能是评分重点
3. 48 小时内数据预处理量大,资源 11/13 才发布,届时再决定用现成 DEM 还是预算地平线遮罩
4. 同题至少已有 2 支队 + 1 个公开仓库线索,差异化需要想清楚

## 8. 未完成 / 待核实

- [x] LunaHorizon:已用 README、raw 链接、作者主页、再次搜索尝试,均无法读到内容;结论是"对外不可见,内容不明"
- [x] spicedmoon:协议 LGPL-3.0、Alpha、支持月面观测者;是否直接输出月面看到的太阳/地球高度角未验证
- [ ] 直连地球通信窗口的物理判据:**没有从来源里查到明确阈值**(月面站点对地球的最小仰角、天平动幅度、地形遮蔽的处理方式)。只有定性信息:SVS 5228 说南极看到的地球"离 0° 经度不远、上下摆动"。具体数值需读 Bryant 2009 全文或其他 NASA 报告,再决定
- [x] Terms & Conditions 已读主要部分(见第 1 节);"赛前工作"限制只见于 FAQ,条款已读部分未见
- [ ] 条款中关于参与资格(如与中国实体相关的限制)请队内逐条对照原文
- [ ] 向 Local Lead 确认赛前准备的边界
- [ ] 11/13 后读取官方 Resources 标签
- [ ] 队伍规模和技能分工(决定技术栈)
