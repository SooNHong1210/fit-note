-- list_classes_for_member 에 trainer_id 추가 (회원 슬롯 계산에서 선생님별 그룹수업 제외용).
-- 반환 타입이 바뀌므로 drop 후 재생성.

drop function if exists list_classes_for_member();

create or replace function list_classes_for_member()
  returns table(id uuid, title text, trainer_id uuid, starts_at timestamptz,
                ends_at timestamptz, capacity int, enrolled_count bigint,
                enrolled_by_me boolean)
  language sql security definer set search_path = public as $$
    select c.id, c.title, c.trainer_id, c.starts_at, c.ends_at, c.capacity,
      (select count(*) from enrollments e where e.class_id = c.id),
      exists(select 1 from enrollments e2 join members m on m.id = e2.member_id
             where e2.class_id = c.id and m.auth_user_id = auth.uid())
    from group_classes c
    where c.shop_id in (select shop_id from members where auth_user_id = auth.uid())
    order by c.starts_at;
  $$;
grant execute on function list_classes_for_member() to anon, authenticated;
