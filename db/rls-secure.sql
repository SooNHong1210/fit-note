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

-- 그룹 수업: 회원이 자기 예약 등록행만 삭제(취소). 조회·등록은 아래 RPC로.
drop policy if exists enrollments_member_delete on enrollments;
create policy enrollments_member_delete on enrollments for delete to authenticated
  using (member_id in (select my_member_ids()));

-- 회원용 클래스 목록: 정원/등록수/내 등록여부 (다른 회원 등록행은 노출 안 함)
create or replace function list_classes_for_member()
  returns table(id uuid, title text, starts_at timestamptz, ends_at timestamptz,
                capacity int, enrolled_count bigint, enrolled_by_me boolean)
  language sql security definer set search_path = public as $$
    select c.id, c.title, c.starts_at, c.ends_at, c.capacity,
      (select count(*) from enrollments e where e.class_id = c.id),
      exists(select 1 from enrollments e2 join members m on m.id = e2.member_id
             where e2.class_id = c.id and m.auth_user_id = auth.uid())
    from group_classes c
    where c.shop_id in (select shop_id from members where auth_user_id = auth.uid())
    order by c.starts_at;
  $$;
grant execute on function list_classes_for_member() to anon, authenticated;

-- 선착순 등록(정원 초과 방지: 행 잠금으로 직렬화)
create or replace function enroll_class(p_class_id uuid) returns text
  language plpgsql security definer set search_path = public as $$
declare v_shop uuid; v_cap int; v_member uuid; v_count int;
begin
  select shop_id, capacity into v_shop, v_cap from group_classes where id = p_class_id;
  if v_shop is null then return 'not_member'; end if;
  select id into v_member from members
    where auth_user_id = auth.uid() and shop_id = v_shop limit 1;
  if v_member is null then return 'not_member'; end if;
  if exists(select 1 from enrollments where class_id = p_class_id and member_id = v_member)
    then return 'already'; end if;
  perform 1 from group_classes where id = p_class_id for update;
  select count(*) into v_count from enrollments where class_id = p_class_id;
  if v_count >= v_cap then return 'full'; end if;
  insert into enrollments(shop_id, class_id, member_id) values (v_shop, p_class_id, v_member);
  return 'ok';
exception when unique_violation then return 'already';
end $$;
grant execute on function enroll_class(uuid) to anon, authenticated;

-- NOTE: shops 는 schema.sql 의 public read 유지(가입 코드 조회용).
-- 잔여 노출: 회원은 같은 샵의 다른 예약/수업 '시간'과 member_id 를 볼 수 있음
--   (슬롯 마감 표시에 필요). 이름 등은 노출 안 됨. 더 줄이려면 슬롯 계산을 RPC로.
