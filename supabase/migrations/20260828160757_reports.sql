-- 사용자 신고 (부적절한 그림 제보)
-- 적용: Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
--
-- 기기(device)당 그림 하나에 1회만 — PK가 중복 신고를 DB 레벨에서 막는다.
-- 관리자가 "문제없음"으로 판단하면 dismissed_at을 채워 신고함에서 내린다
-- (행은 남겨 둔다 — 같은 기기가 다시 신고해 목록을 되살리는 것을 PK가 막아 준다).
create table if not exists reports (
  drawing_id   uuid not null references drawings(id) on delete cascade,
  device_id    uuid not null,
  reason       text not null,              -- inappropriate | sexual | hate | other
  created_at   timestamptz not null default now(),
  dismissed_at timestamptz,                -- 관리자가 반려한 신고
  primary key (drawing_id, device_id)
);

-- 관리자 신고함의 핫패스 (미처리 신고만 훑는다)
create index if not exists reports_open_idx
  on reports (drawing_id) where dismissed_at is null;

-- 신고 레이트리밋 조회용 (기기별 최근 신고 수)
create index if not exists reports_device_recent_idx
  on reports (device_id, created_at desc);

-- RLS 활성화: service_role만 접근. 클라이언트는 항상 서버 API를 거친다.
alter table reports enable row level security;
