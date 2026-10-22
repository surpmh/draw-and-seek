-- Draw & Seek 스키마
-- 적용: Supabase 대시보드 → SQL Editor 에 붙여넣고 Run
-- (클라이언트는 이 테이블에 직접 접근하지 않음 — 모든 접근은 서버 API 라우트가 service_role로 수행)

-- 캔버스 메타 (단일 행). 그림 숨김/발견마다 version +1 → 모든 타일 URL 무효화.
create table if not exists canvas (
  id      int primary key default 1,
  width   int    not null,
  height  int    not null,
  version bigint not null default 1,
  constraint canvas_singleton check (id = 1)
);

create table if not exists drawings (
  id         uuid primary key default gen_random_uuid(),
  nickname   text not null,               -- 숨긴 사람 (제목 없음)
  device_id  uuid not null,               -- 익명 식별자 (localStorage)
  image_path text not null,               -- 저장소 경로 (trim된 PNG)
  x          int  not null,               -- 월드 좌표 (서버 전용, 클라이언트 비공개)
  y          int  not null,
  w          int  not null,               -- 배치 크기 (min/max 검증 후)
  h          int  not null,
  created_at timestamptz not null default now(),
  found_at   timestamptz,                 -- 소프트 델리트
  found_by   text,                        -- 찾은 사람 닉네임 (선택)
  removed_at timestamptz                  -- 관리자 제재 (moderation.sql — 복구 가능 소프트 삭제)
);

-- 미발견 그림 조회 가속 (목록·랭킹·타일 합성의 핫패스)
create index if not exists drawings_unfound_idx
  on drawings (found_at) where found_at is null;

-- 레이트리밋용 찾기 시도 로그
create table if not exists find_attempts (
  device_id    uuid not null,
  ip           inet not null,
  attempted_at timestamptz not null default now()
);
create index if not exists find_attempts_recent_idx
  on find_attempts (device_id, attempted_at desc);

-- RLS 활성화: service_role만 접근(RLS 우회). anon/authenticated 정책은 만들지 않으므로
-- 클라이언트에서 직접 접근하면 전부 거부됨.
alter table canvas       enable row level security;
alter table drawings     enable row level security;
alter table find_attempts enable row level security;

-- 전역 버전 원자적 증가용 함수 (경합 없이 +1 후 새 값 반환)
create or replace function bump_canvas_version()
returns bigint
language sql
as $$
  update canvas set version = version + 1 where id = 1 returning version;
$$;
