import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

if (process.env.NODE_ENV === "development") {
  initOpenNextCloudflareForDev();
}

// 타일·그림은 Supabase Storage에서 서빙하므로 로컬 파일 번들링 불필요
const nextConfig: NextConfig = {};

export default nextConfig;
