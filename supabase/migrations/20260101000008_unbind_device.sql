-- 회원 기기 잠금 해제: claim_member 가 '이미 다른 기기에 연결됨'을 더 이상 막지 않음.
-- 어느 기기에서든 이름+생일로 재인증하면 그 기기로 다시 연결됨(마지막 기기 우선).
-- ⚠️ 사칭 방지(기기 고정) 완화. 선생님이 '기기 초기화'로 수동 복구.

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
  update members
     set auth_user_id = auth.uid(), device_public_key = p_device, status = 'active'
   where id = m.id;
  return m.id;
end $$;
grant execute on function claim_member(uuid, text, text, text) to anon, authenticated;
