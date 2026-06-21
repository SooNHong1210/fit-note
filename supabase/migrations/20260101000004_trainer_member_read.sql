-- 회원(익명 인증)이 자기 샵의 선생님 목록을 읽을 수 있게 (예약 시 선생님 선택/표시).
-- my_member_shop_ids() 는 rls_secure 마이그레이션에서 정의됨.

drop policy if exists trainers_member_read on trainers;
create policy trainers_member_read on trainers for select to authenticated
  using (shop_id in (select my_member_shop_ids()));
