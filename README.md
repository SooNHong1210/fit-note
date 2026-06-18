# 핏노트 (FitNote)

> 개인 PT샵 / 회원제 예약 샵을 위한 가벼운 **예약 · 회원 관리** 서비스.
> 선생님은 싸게 쓰고, 회원은 가볍게 예약하며, 알림은 확실히 도달하는 것이 목표.

기획·의사결정의 전체 맥락은 [SPEC.md](./SPEC.md) 참고.

---

## 핵심 기능

**선생님 (웹앱)**
- 달력 — 월 뷰, 날짜별 수업 목록 / 추가 · 완료 · 취소 · 삭제
- 회원 관리 — 이름 · 생년월일 · 전화번호(알림톡용), 수업 코멘트 기록
- 회원권 — 총 횟수 발급, 수업 완료 시 **자동 차감**(예: 6/10), 수동 보정
- 설정 — 샵 이름 · 세션 길이 · 요일별 영업시간
- 예약 인박스 — 신청 승인/거절(승인 시 수업 자동 생성), 상태 가시화

**회원 (웹앱, `/m`)**
- 이름 + 생년월일로 본인확인 → 기기 등록(이후 자동 로그인)
- 달력에서 빈 슬롯 선택해 예약 신청
- 예약 상태 확인(신청됨 → 선생님 확인 중 → 승인/거절)
- 선생님 코멘트 · 회원권 잔여 열람

---

## 기술 스택

| 영역 | 선택 |
|---|---|
| 프레임워크 | Next.js 16 (App Router) + React 19 + TypeScript |
| 스타일 | Tailwind CSS v4 |
| 백엔드/DB | Supabase (PostgreSQL) — 미설정 시 자동으로 localStorage 모드 |
| PWA | manifest + 서비스워커 (오프라인 셸 캐싱) |
| 테스트 | Vitest (+ jsdom) |

---

## 시작하기

```bash
npm install
npm run dev          # http://localhost:3000
```

환경변수 없이 실행하면 **localStorage 모드**로 즉시 동작합니다(데이터는 브라우저에만 저장, 단일 기기 검증용).

- 선생님 화면: `/calendar`, `/members`, `/bookings`, `/settings`
- 회원 화면: `/m`

### Supabase 연동 (교차 기기 예약에 필요)

localStorage는 한 브라우저 안에서만 동작합니다. 회원 폰 ↔ 선생님 폰 같은 **실제 교차 기기 예약**은 Supabase 연결이 필요합니다.

1. [supabase.com](https://supabase.com) 에서 프로젝트 생성 (Region: Seoul 권장)
2. SQL Editor에서 순서대로 실행:
   - (재실행 시) [db/reset.sql](./db/reset.sql) — 기존 테이블 삭제 ⚠️
   - [db/schema.sql](./db/schema.sql) — 테이블 + 선생님(owner) RLS
   - **회원 보안**: [db/rls-secure.sql](./db/rls-secure.sql) — 회원 익명인증 기반 타이트 RLS + `claim_member` RPC. **(실데이터용 — 권장)**
     - 또는 빠른 시연만: [db/rls-demo.sql](./db/rls-demo.sql) (⚠️ 회원 데이터 비보호, 가짜 데이터만)
   - (실시간) [db/realtime.sql](./db/realtime.sql) — 예약 변경 실시간 방송
3. Supabase 대시보드 설정:
   - **Authentication → Providers → Email**: "Confirm email" 끄기(데모)
   - **Authentication → Anonymous sign-ins** 켜기 (rls-secure 회원 인증에 필요)
   - (배포 시) **URL Configuration → Redirect URLs**: `https://<도메인>/reset`
4. 상단 **Connect** 또는 Settings → API 에서 URL · 공개 키 복사 → `.env.local` 작성
   (`.env.local.example` 참고). `NEXT_PUBLIC_USE_LOCAL=false` 로 둘 것.
5. dev 서버 재시작 → 자동으로 Supabase 모드 전환

### 웹푸시 알림 (선택)
1. `npx web-push generate-vapid-keys` 로 키 생성
2. `.env.local` 에 `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`,
   `SUPABASE_SERVICE_ROLE_KEY` 입력
3. 선생님이 **설정 → 예약 알림 → "이 기기로 알림 받기"** 로 구독 → 회원 예약 시 푸시 도착
4. 배포(HTTPS)에서만 동작. iOS는 홈 화면 추가 + 16.4+ 필요(신뢰성 약함)

> **보안 현황:** [db/rls-secure.sql](./db/rls-secure.sql) 적용 시 선생님은 자기 샵만, 회원은
> 자기 데이터만 접근(회원은 익명인증). 잔여 노출: 회원은 같은 샵의 예약/수업 *시간*은
> 볼 수 있음(슬롯 계산용). `rls-demo.sql` 은 시연 전용으로 회원 데이터를 보호하지 않습니다.

---

## 테스트

```bash
npm test          # 1회 실행
npm run test:watch
```

순수 로직 위주(TDD): 예약 슬롯 계산([slots.ts](./src/lib/slots.ts)), 회원권 차감([pass.ts](./src/lib/pass.ts)), 날짜 유틸, 저장소(CRUD · 본인확인 · 예약 상태 흐름).

---

## 프로젝트 구조

```
src/
  app/
    calendar/        선생님 달력
    members/         회원 목록 · 상세(코멘트 · 회원권)
    bookings/        예약 인박스
    settings/        샵 · 영업시간
    m/               회원 앱(본인확인 · 예약 · 상태)
    manifest.ts      PWA manifest
  components/        Nav, ServiceWorker
  lib/
    types.ts         도메인 타입
    repositories/    저장소 추상화 (local · supabase 교체 가능)
    slots.ts         예약 가능 슬롯 계산
    pass.ts          회원권 차감 로직
    date.ts          날짜 유틸
    memberSession.ts 회원 기기 신원/세션
  test/setup.ts      테스트용 localStorage
db/
  schema.sql         Supabase 스키마
  reset.sql          테이블 초기화(테스트용)
```

### 설계 원칙
- **저장소 추상화** — 모든 데이터 접근은 `Repository` 인터페이스 한 곳을 통과. localStorage ↔ Supabase 교체가 환경변수 한 줄로 끝나고, 향후 DB 이전·암호화 도입도 이 경계 뒤에서만 수정.
- **이전 가능성** — 표준 PostgreSQL만 사용(벤더 락인 회피).
- **민감 필드 격리** — 생년월일 · 코멘트 등은 비즈니스 쿼리에 직접 엮지 않음(향후 암호화 대비).
- **멀티 선생님 대비** — `trainers` 테이블 · `trainer_id` 컬럼을 미리 두되(한 선생님 전담 모델), UI는 단일 선생님으로 동작.

---

## 로드맵

- **Stage 0** ✅ 선생님 도구 (달력 · 회원관리 · 코멘트)
- **Stage 1** ✅ 예약 루프 (영업시간 · 회원 본인확인 · 예약 신청/승인 · 상태 가시화) + 회원권
- **멀티 샵** ✅ 선생님 가입/로그인 + 샵별 데이터 격리 + 샵 주소(slug) 초대 링크
- **알림** ✅ 실시간 인박스 갱신(Realtime) + 웹푸시(VAPID, 배포 시 검증 필요)
- **회원 보안** ✅ 익명인증 + 타이트 RLS([rls-secure.sql](./db/rls-secure.sql), Supabase에서 적용·검증 필요)
- **다음** — 위 Supabase 기능 실배포 검증, 카카오 알림톡, 멀티 선생님 UI, 구독 결제
