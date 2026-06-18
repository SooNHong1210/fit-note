-- ✅ 회원측 보안 RLS (rls-demo.sql 대체용 — 실데이터용).
--
-- 모델: 회원은 Supabase '익명 인증'으로 로그인(authenticated 롤, is_anonymous).
--   - 이름+생일 조회/연결은 SECURITY DEFINER 함수 claim_member 로만(직접 select 불가).
--   - 이후 회원은 자기 데이터 + 자기 샵의 슬롯 계산용 시간 정보만 접근.
-- 선생님(owner) 정책은 schema.sql 그대로. 아래는 회원(익명 인증)용 추가.
--
-- 사전 설정: Supabase 대시보드 → Authentication → 'Anonymous sign-ins' 활성화.
--
-- 적용: schema.sql 실행 후 이 파일 실행. (rls-demo.sql 은 실행하지 말 것)

-- 1) 데모 anon 정책 제거 (있다면)
drop policy if exists members_anon_read on members;
drop policy if exists members_anon_update on members;
drop policy if exists availability_anon_read on availability;
drop policy if exists lessons_anon_read on lessons;
drop policy if exists comments_anon_read on comments;
drop policy if exists bookings_anon_read on bookings;
drop policy if exists bookings_anon_insert on bookings;

-- 2) RLS 재귀 방지용 헬퍼 (security definer 로 members RLS 우회)
create or replace function my_member_ids()
  returns setof uuid language sql stable security definer
  set search_path = public as $$
    select id from members where auth_user_id = auth.uid()
  $$;

create or replace function my_member_shop_ids()
  returns setof uuid language sql stable security definer
  set search_path = public as $$
    select shop_id from members where auth_user_id = auth.uid()
  $$;

-- 3) 이름+생일 본인확인 & 기기 연결 (유일한 '미연결 회원 조회' 경로)
create or replace function claim_member(
  p_shop_id uuid, p_name text, p_birth text, p_device text
) returns uuid language plpgsql security definer
  set search_path = public as $$
declare m members%rowtype;
begin
  select * into m from members
   where shop_id = p_shop_id and name = p_name and birth_date = p_birth
   limit 1;
  if not found then return null; end if;
  -- 이미 다른 기기·계정이 연결됐고, 같은 기기키도 아니면 거부(사칭 방지)
  if m.auth_user_id is not null
     and m.auth_user_id <> auth.uid()
     and m.device_public_key is distinct from p_device then
    raise exception 'already_claimed';
  end if;
  update members
     set auth_user_id = auth.uid(), device_public_key = p_device, status = 'active'
   where id = m.id;
  return m.id;
end $$;
grant execute on function claim_member(uuid, text, text, text) to anon, authenticated;

-- 4) 회원(익명 인증) 정책
-- 회원: 자기 행만 조회/수정
drop policy if exists members_self on members;
create policy members_self on members for select to authenticated
  using (auth_user_id = auth.uid());
drop policy if exists members_self_update on members;
create policy members_self_update on members for update to authenticated
  using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());

-- 영업시간: 자기 샵만 읽기 (슬롯 계산)
drop policy if exists availability_member_read on availability;
create policy availability_member_read on availability for select to authenticated
  using (shop_id in (select my_member_shop_ids()));

-- 수업: 자기 샵 시간 읽기 (슬롯 계산)
drop policy if exists lessons_member_read on lessons;
create policy lessons_member_read on lessons for select to authenticated
  using (shop_id in (select my_member_shop_ids()));

-- 코멘트: 자기 것만
drop policy if exists comments_member_read on comments;
create policy comments_member_read on comments for select to authenticated
  using (member_id in (select my_member_ids()));

-- 예약: 자기 샵 시간 읽기(슬롯 계산) + 자기 명의로 신청
drop policy if exists bookings_member_read on bookings;
create policy bookings_member_read on bookings for select to authenticated
  using (shop_id in (select my_member_shop_ids()));
drop policy if exists bookings_member_insert on bookings;
create policy bookings_member_insert on bookings for insert to authenticated
  with check (member_id in (select my_member_ids()));

-- NOTE: shops 는 schema.sql 의 public read 유지(가입 코드 조회용).
-- 잔여 노출: 회원은 같은 샵의 다른 예약/수업 '시간'과 member_id 를 볼 수 있음
--   (슬롯 마감 표시에 필요). 이름 등은 노출 안 됨. 더 줄이려면 슬롯 계산을 RPC로.
