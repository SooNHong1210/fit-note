-- ⚠️ 데모용 회원(anon) 접근 정책.
-- 회원은 Supabase 로그인 없이 anon 키로 접근하므로, 회원 앱이 동작하려면
-- anon 롤에 읽기/일부 쓰기를 열어야 한다. 단 이 정책은 anon이 "모든 샵"의
-- 회원·예약을 조회할 수 있게 하므로 — 회원 개인정보가 보호되지 않는다.
--   ✅ 플로우 시연 / 가짜 데이터 OK
--   ❌ 실제 회원 데이터 금지
-- 진짜 보안은 회원 인증(Supabase 익명 인증 등) + device_public_key 스코프 정책 필요(후속).
--
-- 선생님(authenticated)은 schema.sql의 owner 정책으로 자기 샵만 접근하며,
-- 아래 정책은 `to anon` 으로 한정해 선생님 격리에는 영향이 없다.

-- 회원: 본인확인(select) + 기기연결(update)
drop policy if exists members_anon_read on members;
create policy members_anon_read on members for select to anon using (true);
drop policy if exists members_anon_update on members;
create policy members_anon_update on members for update to anon
  using (true) with check (true);

-- 영업시간: 슬롯 계산용 읽기
drop policy if exists availability_anon_read on availability;
create policy availability_anon_read on availability for select to anon using (true);

-- 수업: 슬롯 계산/내 기록 읽기
drop policy if exists lessons_anon_read on lessons;
create policy lessons_anon_read on lessons for select to anon using (true);

-- 코멘트: 내 코멘트 읽기
drop policy if exists comments_anon_read on comments;
create policy comments_anon_read on comments for select to anon using (true);

-- 예약: 슬롯 계산/내 예약 읽기 + 신청(insert)
drop policy if exists bookings_anon_read on bookings;
create policy bookings_anon_read on bookings for select to anon using (true);
drop policy if exists bookings_anon_insert on bookings;
create policy bookings_anon_insert on bookings for insert to anon with check (true);

-- shops 는 schema.sql 에서 이미 public read(코드 조회용).
