import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker 镜像用 standalone 输出（体积小）；Vercel 和本地开发不需要，所以只在 Dockerfile 里打开这个开关。
  output: process.env.BUILD_STANDALONE === "1" ? "standalone" : undefined,
};

export default nextConfig;
