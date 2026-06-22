-- 회원 웹푸시: push_subscriptions 에 member_id 추가(회원 구독 구분) + 회원 RLS.
-- member_id NULL = 선생님 기기 구독, 값 있음 = 회원 기기 구독.

alter table push_subscriptions
  add column if not exists member_id uuid references members(id) on delete cascade;
create index if not exists push_member_idx on push_subscriptions(member_id);

-- 회원(익명 인증)이 자기 구독을 추가/조회/삭제
drop policy if exists push_member_insert on push_subscriptions;
create policy push_member_insert on push_subscriptions for insert to authenticated
  with check (member_id in (select my_member_ids()));
drop policy if exists push_member_select on push_subscriptions;
create policy push_member_select on push_subscriptions for select to authenticated
  using (member_id in (select my_member_ids()));
drop policy if exists push_member_delete on push_subscriptions;
create policy push_member_delete on push_subscriptions for delete to authenticated
  using (member_id in (select my_member_ids()));
