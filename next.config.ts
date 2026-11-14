import type { NextConfig } from "next";

// API / MCP 读的预计算地图文件（pipeline 产出，见 pipeline/README.md）。它们是运行时用 fs 读的，Next 没法自己发现，
// 所以要明确告诉它把这些文件打进对应函数的运行包。
const mapDataFiles = [
  "./public/data/v1/manifest.json",
  "./public/data/v1/horizon-4ppd.u8",
  "./public/data/v1/height-4ppd.i16",
  "./public/data/v1/slope-4ppd.u16",
  "./public/data/v1/aspect-4ppd.u16",
];

// "按条件找位置"（find_sites）扫整张地图：读 manifest、高度、坡度和一年统计（约 19 MB），不读地平线。
const siteSearchDataFiles = [
  "./public/data/v1/manifest.json",
  "./public/data/v1/height-4ppd.i16",
  "./public/data/v1/slope-4ppd.u16",
  "./public/data/v1/stats-4ppd.u16",
];

// 会同时用到点位数据和找位置的入口（MCP、agent 通过工具注册表能调到所有工具）。
const allToolDataFiles = [...mapDataFiles, "./public/data/v1/stats-4ppd.u16"];

const nextConfig: NextConfig = {
  // Docker 镜像用 standalone 输出（体积小）；Vercel 和本地开发不需要，所以只在 Dockerfile 里打开这个开关
  // （Docker 里整个 public/ 都会拷进镜像，不受下面这张表影响）。
  output: process.env.BUILD_STANDALONE === "1" ? "standalone" : undefined,
  // 产品页的大贴图（月面影像、高度、坡度、天空）几乎不变：让浏览器缓存一天，之后一周内先用旧的、后台更新，
  // 回访不用每张图都重新确认。只列 moon 和 sky 两个子目录，不能写成 /product/:path*（那会把 /product 页面本身也缓存一天）。
  // 代价：贴图换了内容但文件名没变时，已经访问过的人最多一天后才看到新的。
  async headers() {
    const cache = [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }];
    return [
      { source: "/product/moon/:path*", headers: cache },
      { source: "/product/sky/:path*", headers: cache },
    ];
  },
  // 只给会读数据的路由带数据；health、presets 不读，不带，省函数包体积。新增会读数据的路由，要在这里加一行，
  // 否则本地能跑、部署到 Vercel 后找不到文件。
  outputFileTracingIncludes: {
    "/api/point": mapDataFiles,
    "/api/compare": mapDataFiles,
    "/api/timeline": mapDataFiles,
    "/api/compare-dates": mapDataFiles,
    "/api/find-sites": siteSearchDataFiles,
    "/api/agent": allToolDataFiles,
    "/mcp": allToolDataFiles,
  },
};

export default nextConfig;
