import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// 언어별 정적 페이지는 빌드 산출물에서 읽는다. 동적 API는 Supabase를 직접 조회한다.
// 읽기 전용 Static Assets 캐시이므로 R2/KV/Queues나 재검증용 서비스가 필요 없다.
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
  enableCacheInterception: true,
});
