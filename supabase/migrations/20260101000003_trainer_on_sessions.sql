-- 멀티 선생님: 세션(수업/클래스/예약)에 담당 선생님 지정.
-- (members.trainer_id = 기본 담당, availability.trainer_id = 선생님별 영업시간은 이미 존재)

alter table lessons
  add column if not exists trainer_id uuid references trainers(id) on delete set null;
alter table group_classes
  add column if not exists trainer_id uuid references trainers(id) on delete set null;
alter table bookings
  add column if not exists trainer_id uuid references trainers(id) on delete set null;
