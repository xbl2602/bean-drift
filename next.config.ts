import type { NextConfig } from "next";

// API / MCP 读的预计算地图文件（pipeline 产出，见 pipeline/README.md）。它们是运行时用 fs 读的，Next 没法自己发现，
// 所以要明确告诉它把这些文件打进对应函数的运行包。stats-4ppd.u16 只给网页图层用，API 不读，不打包。
const mapDataFiles = [
  "./public/data/v1/manifest.json",
  "./public/data/v1/horizon-4ppd.u8",
  "./public/data/v1/height-4ppd.i16",
  "./public/data/v1/slope-4ppd.u16",
  "./public/data/v1/aspect-4ppd.u16",
];

const nextConfig: NextConfig = {
  // Docker 镜像用 standalone 输出（体积小）；Vercel 和本地开发不需要，所以只在 Dockerfile 里打开这个开关。
  output: process.env.BUILD_STANDALONE === "1" ? "standalone" : undefined,
  // 只给会算点位参数的路由带数据（agent 通过工具注册表间接读）；health、presets 不读，不带，省函数包体积。
  outputFileTracingIncludes: {
    "/api/point": mapDataFiles,
    "/api/compare": mapDataFiles,
    "/api/agent": mapDataFiles,
    "/mcp": mapDataFiles,
  },
};

export default nextConfig;
