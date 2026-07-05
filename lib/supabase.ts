import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * 서버 전용 Supabase 클라이언트 (service_role).
 * RLS를 우회하는 관리자 키이므로 절대 클라이언트 번들에 포함되면 안 된다.
 * 반드시 API 라우트/서버 코드에서만 import 할 것.
 */
let cached: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수가 없습니다 (.env.local 확인)",
    );
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
