-- Supabase Realtime: bookings 테이블 변경을 클라이언트로 방송.
-- 선생님 인박스/배지와 회원 "내 예약" 상태가 실시간 갱신되려면 필요.
-- (localStorage 모드에서는 불필요 — 탭 간 storage 이벤트로 대체)

alter publication supabase_realtime add table bookings;
