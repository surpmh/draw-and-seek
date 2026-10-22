-- 관리자 제재(부적절 그림 소프트 삭제) 마커
-- 적용:
--   로컬 — `npm run db:reset` (supabase CLI가 이 폴더의 마이그레이션을 순서대로 실행)
--   운영 — Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
--
-- 삭제 = removed_at 기록 (+ 미발견이었다면 found_at도 같은 값으로 → 캔버스/목록에서 즉시 제외).
-- DB 행과 PNG 파일은 보존되므로 관리자 페이지에서 언제든 복구 가능.
alter table drawings add column if not exists removed_at timestamptz;
