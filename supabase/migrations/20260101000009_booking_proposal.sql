-- 예약 거절 코멘트 + '다른 시간 제안' 기능.
-- teacher_note: 선생님 메모(거절/제안 사유). proposed_*: 제안 시간. status 'proposed' 추가.

alter table bookings drop constraint if exists bookings_status_check;
alter table bookings add constraint bookings_status_check
  check (status in ('requested','seen','approved','rejected','canceled','proposed'));

alter table bookings add column if not exists teacher_note text;
alter table bookings add column if not exists proposed_starts_at timestamptz;
alter table bookings add column if not exists proposed_ends_at timestamptz;

-- 회원이 '다른 시간 제안'에 응답. 수락 시 제안 시간으로 확정 + 수업 생성.
create or replace function respond_proposal(p_booking_id uuid, p_accept boolean)
  returns text language plpgsql security definer set search_path = public as $$
declare
  v_member uuid; v_status text; v_shop uuid; v_trainer uuid;
  v_ps timestamptz; v_pe timestamptz;
begin
  select member_id, status, shop_id, trainer_id, proposed_starts_at, proposed_ends_at
    into v_member, v_status, v_shop, v_trainer, v_ps, v_pe
    from bookings where id = p_booking_id;
  if v_member is null then return 'not_found'; end if;
  if not exists(
    select 1 from members where id = v_member and auth_user_id = auth.uid()
  ) then return 'forbidden'; end if;
  if v_status <> 'proposed' then return 'ok'; end if;
  if p_accept then
    update bookings set status = 'approved', slot_starts_at = v_ps, slot_ends_at = v_pe
      where id = p_booking_id;
    insert into lessons(shop_id, member_id, trainer_id, starts_at, ends_at)
      values (v_shop, v_member, v_trainer, v_ps, v_pe);
  else
    update bookings set status = 'canceled' where id = p_booking_id;
  end if;
  return 'ok';
end $$;
grant execute on function respond_proposal(uuid, boolean) to anon, authenticated;
