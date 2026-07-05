-- 따봉(좋아요) — 기기(device)당 그림 하나에 1회, 취소 가능
-- 적용: Supabase 대시보드 → SQL Editor 에서 실행
create table if not exists likes (
  drawing_id uuid not null references drawings(id) on delete cascade,
  device_id  uuid not null,
  created_at timestamptz not null default now(),
  primary key (drawing_id, device_id)
);
create index if not exists likes_drawing_idx on likes (drawing_id);

alter table likes enable row level security; -- 정책 없음 = 클라이언트 직접 접근 차단 (서버 service_role만)
