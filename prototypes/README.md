# prototypes/：原型与实验

这里放**画面和算法的实验品**。它们能跑、能参考，但**不是产品代码**：产品代码按 [AGENTS.md](../AGENTS.md) 里的目标结构（`app/`、`src/`、`pipeline/`）另写。

## lunar-scene-demo/

月面第一人称场景原型：南极（真实 NASA LOLA 10 m 地形）和阿波罗 11 号静海基地（真实 LROC NAC 2 m 地形），1.6 m 真人眼高，真实星历驱动太阳、地球和星空，时间拖条，山体遮挡下的供电/通信窗口条，远处阴影随时间重算。纯静态页面，不依赖框架。

**运行**

```bash
cd prototypes/lunar-scene-demo
```

```bash
npm install
```

```bash
python serve.py 5191
```

然后浏览器打开 http://localhost:5191/ 。第一次加载场景要 10–25 秒（程序化生成）。

**原始 NASA 数据**（`.JP2`、`.TIF`）太大，不在 git 里；下载地址和处理脚本用法见 [docs/PROJECT_CONTEXT.md](../docs/PROJECT_CONTEXT.md)。`data/derived/` 里已经有处理好的结果，直接运行不需要原始数据。

**文件速览**

| 文件 | 作用 |
|---|---|
| `index.html`、`sites.js`、`nav.js` | 主页（选地点）、地点清单、顶部导航 |
| `lola.html`、`apollo11.html`、`three.html` | 南极、阿波罗 11 号、程序化测试场景的入口页 |
| `scene-three.js`、`common.js` | 场景渲染与公共工具 |
| `lola.js`、`equator.js` | 两个真实地形站点的数据加载 |
| `demgrid.js` | 高度图金字塔、采样、地平线剖面（两个站点共用） |
| `ephemeris.js` | 自带的星历（对照 JPL Horizons 校验过） |
| `shadowcast.js`、`shadowWorker.js` | 远处阴影，随时间重算 |
| `timeui.js` | 时间拖条 |
| `tools/` | 数据处理脚本（Python/Node），**要在本目录里运行**，将来迁入 `pipeline/` |
| `engine-comparison/` | 早期 three.js / Babylon.js / PlayCanvas 对比页（归档，仍能打开：`/engine-comparison/engines.html`） |

## landing-page-demo/

最早的 landing page 视觉演示（单个 `index.html`），复用 `lunar-scene-demo/` 里的 three.js 南极场景，所以要先把 `lunar-scene-demo/` 跑起来。

## landing-page-v2/

第二版 landing page 示范页：原生 HTML / CSS / JS + three.js，自带 `vendor/` 副本，和 `lunar-scene-demo/` 相互独立。运行方法、哪些是真数据哪些是录播见 [landing-page-v2/README.md](landing-page-v2/README.md)。页面里的接口地址和录播响应只是示意，不代表有线上服务。
