import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // data/tiles는 public이 아니므로 서버 번들에 포함시킨다 (Vercel 배포 대비)
  outputFileTracingIncludes: {
    "/api/tiles/**": ["./data/tiles/**"],
  },
};

export default nextConfig;
