-- ⚠️ 모든 테이블과 데이터를 삭제합니다. 테스트 단계에서만 사용하세요.
-- 사용법: 이 파일을 먼저 실행한 뒤 schema.sql 을 실행하면 깨끗하게 재생성됩니다.
-- (이전에 옛 버전 스키마를 실행해 컬럼이 안 맞을 때 사용)

drop table if exists bookings cascade;
drop table if exists comments cascade;
drop table if exists lessons cascade;
drop table if exists availability cascade;
drop table if exists members cascade;
drop table if exists trainers cascade;
drop table if exists shops cascade;
