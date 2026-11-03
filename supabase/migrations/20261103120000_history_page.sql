-- 히스토리(역대 랭킹) 페이지 조회
-- 적용:
--   로컬 — `npm run db:reset` (supabase CLI가 이 폴더의 마이그레이션을 순서대로 실행)
--   운영 — Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
--
-- 순위 = 숨어 있(었)던 시간(발견 시각 또는 현재 - 숨긴 시각) 내림차순. 이 값은 now()에 따라
-- 변하므로 컬럼으로 저장할 수 없어 조회 시점에 계산한다.
-- 순위는 전체 기준으로 매긴 뒤 검색·필터를 적용한다 (검색해도 원래 순위 유지).
-- 반환: { total: 필터 후 전체 건수, items: [해당 페이지 행] }
create or replace function history_page(
  p_query  text default '',
  p_filter text default 'all',   -- all | hidden | found
  p_limit  int  default 10,
  p_offset int  default 0
)
returns jsonb
language sql
stable
as $$
  with ranked as (
    select
      d.id,
      d.nickname,
      d.created_at,
      d.found_at,
      (extract(epoch from coalesce(d.found_at, now()) - d.created_at) * 1000)::bigint as survived_ms
    from drawings d
    where d.removed_at is null -- 관리자 제재 그림은 기록에서도 제외
  ),
  numbered as (
    select r.*, row_number() over (order by r.survived_ms desc, r.id) as rank
    from ranked r
  ),
  filtered as (
    select n.*
    from numbered n
    where (coalesce(p_query, '') = '' or strpos(lower(n.nickname), lower(p_query)) > 0)
      and (
        p_filter = 'all'
        or (p_filter = 'hidden' and n.found_at is null)
        or (p_filter = 'found' and n.found_at is not null)
      )
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'items', coalesce(
      (
        select jsonb_agg(to_jsonb(p) order by p.rank)
        from (select * from filtered order by rank limit p_limit offset p_offset) p
      ),
      '[]'::jsonb
    )
  );
$$;
