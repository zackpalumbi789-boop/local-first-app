import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `pg` 在 Next 默认 serverExternal 列表中；Turbopack 会生成 pg-<hash> 外部包，
  // 部分托管（如 EdgeOne Pages）运行时无法解析。加入 transpilePackages 会把 pg 打进 bundle。
  transpilePackages: ["pg"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.aliyuncs.com",
      },
    ],
  },
};

export default nextConfig;
