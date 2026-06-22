-- 예약 취소: bookings.status 에 'canceled' 추가 + 회원 취소 RPC.

alter table bookings drop constraint if exists bookings_status_check;
alter table bookings add constraint bookings_status_check
  check (status in ('requested','seen','approved','rejected','canceled'));

-- 회원이 자기 예약을 취소. 승인된 예약이면 대응 수업도 함께 취소.
create or replace function cancel_booking(p_booking_id uuid) returns text
  language plpgsql security definer set search_path = public as $$
declare v_member uuid; v_status text; v_start timestamptz;
begin
  select member_id, status, slot_starts_at
    into v_member, v_status, v_start
    from bookings where id = p_booking_id;
  if v_member is null then return 'not_found'; end if;
  if not exists(
    select 1 from members where id = v_member and auth_user_id = auth.uid()
  ) then
    return 'forbidden';
  end if;
  if v_status in ('rejected','canceled') then return 'ok'; end if;
  if v_status = 'approved' then
    update lessons set status = 'canceled'
      where member_id = v_member and starts_at = v_start and status = 'scheduled';
  end if;
  update bookings set status = 'canceled' where id = p_booking_id;
  return 'ok';
end $$;
grant execute on function cancel_booking(uuid) to anon, authenticated;
