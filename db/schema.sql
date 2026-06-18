-- 핏노트 DB 스키마 (Supabase / PostgreSQL) — 멀티 샵(멀티 테넌시)
--
-- 구조: 선생님 계정(auth.users) 1명이 샵 1개를 소유(shops.owner_id).
--       모든 데이터는 shop_id로 샵에 귀속. RLS로 샵 간 격리.
--
-- 멀티 선생님(한 샵에 여러 선생님)은 trainer_id로 스키마만 준비(현재 UI 미사용).
--
-- 설계 원칙: 표준 Postgres / 민감필드 격리 / 레포지토리 계층 단일 경유.

create extension if not exists "pgcrypto";

-- 샵 (테넌트)
create table if not exists shops (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid references auth.users(id) on delete cascade, -- 소유 선생님
  name            text not null,
  code            text not null unique,        -- 회원 가입 코드(6자리)
  session_minutes integer not null default 50,
  advance_limit   integer not null default 0,  -- 회원당 미리 예약 가능 수(0=무제한)
  created_at      timestamptz not null default now()
);
create index if not exists shops_owner_idx on shops(owner_id);
create index if not exists shops_code_idx on shops(code);

-- 선생님 (한 샵에 여러 선생님 대비, 현재 UI 미사용)
create table if not exists trainers (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references shops(id) on delete cascade,
  name        text not null,
  phone       text,
  created_at  timestamptz not null default now()
);

-- 회원
create table if not exists members (
  id                 uuid primary key default gen_random_uuid(),
  shop_id            uuid not null references shops(id) on delete cascade,
  trainer_id         uuid references trainers(id) on delete set null,
  auth_user_id       uuid references auth.users(id) on delete set null, -- 회원 익명 인증 연결(보안 RLS용)
  name               text not null,
  birth_date         text,                 -- 격리 대상: 본인확인용
  phone              text,                 -- 알림톡용(선택)
  device_public_key  text,
  status             text not null default 'invited'
                     check (status in ('invited','active')),
  pass_total         integer not null default 0,
  pass_used          integer not null default 0,
  created_at         timestamptz not null default now()
);
create index if not exists members_shop_idx on members(shop_id);

create table if not exists lessons (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references shops(id) on delete cascade,
  member_id   uuid not null references members(id) on delete cascade,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  status      text not null default 'scheduled'
              check (status in ('scheduled','done','canceled')),
  created_at  timestamptz not null default now()
);
create index if not exists lessons_shop_idx on lessons(shop_id);
create index if not exists lessons_member_idx on lessons(member_id);

create table if not exists comments (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references shops(id) on delete cascade,
  member_id   uuid not null references members(id) on delete cascade,
  lesson_id   uuid references lessons(id) on delete set null,
  text        text not null,        -- 격리 대상: 민감 가능
  created_at  timestamptz not null default now()
);
create index if not exists comments_shop_idx on comments(shop_id);
create index if not exists comments_member_idx on comments(member_id);

create table if not exists availability (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references shops(id) on delete cascade,
  trainer_id  uuid references trainers(id) on delete cascade,
  weekday     integer not null check (weekday between 0 and 6),
  start_time  text not null,
  end_time    text not null
);
create index if not exists availability_shop_idx on availability(shop_id);

create table if not exists bookings (
  id              uuid primary key default gen_random_uuid(),
  shop_id         uuid not null references shops(id) on delete cascade,
  member_id       uuid not null references members(id) on delete cascade,
  slot_starts_at  timestamptz not null,
  slot_ends_at    timestamptz not null,
  status          text not null default 'requested'
                  check (status in ('requested','seen','approved','rejected')),
  created_at      timestamptz not null default now(),
  responded_at    timestamptz
);
create index if not exists bookings_shop_idx on bookings(shop_id);

-- 웹푸시 구독 (선생님 기기별). 선생님이 "알림 받기" 시 저장.
create table if not exists push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references shops(id) on delete cascade,
  endpoint    text not null unique,
  subscription jsonb not null,
  created_at  timestamptz not null default now()
);
create index if not exists push_shop_idx on push_subscriptions(shop_id);

-- ========================= RLS =========================
-- 선생님(로그인 사용자)은 자기 소유 샵의 데이터만 접근.
-- 회원은 Supabase 인증 없이 anon 키로 접근 → 아래 정책은 선생님 격리를 보장하고,
-- 회원 접근(샵 코드 조회, 예약 신청, 자기 데이터 열람)은 별도 설계가 필요.
-- ⚠️ 회원측 RLS(anon 스코프)는 후속 작업. 그 전엔 회원 데이터 보호가 완전하지 않음.

alter table shops enable row level security;
alter table members enable row level security;
alter table lessons enable row level security;
alter table comments enable row level security;
alter table availability enable row level security;
alter table bookings enable row level security;
alter table trainers enable row level security;
alter table push_subscriptions enable row level security;

-- 샵: 소유자는 전체, 코드 조회를 위해 읽기는 공개(이름·코드 노출 수준)
drop policy if exists shops_owner_all on shops;
create policy shops_owner_all on shops
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists shops_public_read on shops;
create policy shops_public_read on shops for select using (true);

-- 소유 샵 데이터: 선생님(소유자)만 전체 접근하는 헬퍼 조건
--   shop_id 가 auth.uid() 소유 샵에 속하는지로 판단.
do $$
declare t text;
begin
  foreach t in array array['members','lessons','comments','availability','bookings','trainers','push_subscriptions']
  loop
    execute format('drop policy if exists %1$s_owner_all on %1$s;', t);
    execute format($f$
      create policy %1$s_owner_all on %1$s for all
        using (shop_id in (select id from shops where owner_id = auth.uid()))
        with check (shop_id in (select id from shops where owner_id = auth.uid()));
    $f$, t);
  end loop;
end $$;

-- TODO(후속): 회원(anon) 접근 정책 — 자기 device_public_key 로 스코프된
--   members/bookings/comments 읽기·쓰기, 해당 샵 availability/lessons 읽기.
