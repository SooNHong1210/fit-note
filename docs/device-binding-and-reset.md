# 회원 기기 묶기 & 기기 초기화 (보류 — 나중에 재사용)

> 2026-06 현재 **기기 묶음은 풀린 상태**입니다. 이 문서는 나중에 다시 켤 때를 위한 설계·코드 보관입니다.

## 배경

회원은 처음에 **이름 + 생년월일**로 본인확인을 하고, 그 순간 기기가 등록됩니다.
Supabase 보안 RLS에서는 회원이 **익명 인증(anonymous auth)** 으로 로그인하고,
`members.auth_user_id` + `members.device_public_key` 에 그 기기/세션이 기록됩니다.

- **기기 묶기(enforce)**: 한 번 등록되면 *다른 기기*에서 같은 이름+생일로 재인증 시
  거부(`already_claimed`). → 한 회원 = 한 기기로 고정 → **사칭 방지**.
- **불편함**: 기기를 바꾸거나 캐시를 지우면 재인증이 막혀 회원이 못 들어옴.

그래서 **묶음을 풀었습니다**(아래 "현재 상태"). 대신 사칭 위험이 다시 생기므로,
나중에 다시 묶거나, 막힌 회원을 푸는 용도로 **선생님용 "기기 초기화"** 를 같이 둡니다.

## 현재 상태 (묶음 풀림)

- `claim_member` RPC가 **항상 재연결을 허용**합니다(마지막 기기 우선).
  [supabase/migrations/20260101000008_unbind_device.sql](../supabase/migrations/20260101000008_unbind_device.sql)
- 어느 기기에서든 이름+생일로 재인증하면 그 기기로 다시 연결됨. "already_claimed" 거부 없음.
- 회원은 여전히 익명 인증으로 로그인하고 `auth_user_id`가 기록됨(자기 데이터 RLS 스코프에 필요).
  즉 *세션/스코프*는 유지되지만 *기기 잠금*만 해제된 것.
- `resetMemberDevice(memberId)` 레포 메서드는 **코드에 존재**하지만 **UI는 없음**(아래 "재사용" 참고).

## 다시 "기기 묶기"를 켜는 법

`claim_member` RPC를 거부 로직 포함 버전으로 새 마이그레이션을 추가:

```sql
create or replace function claim_member(
  p_shop_id uuid, p_name text, p_birth text, p_device text
) returns uuid language plpgsql security definer set search_path = public as $$
declare m members%rowtype;
begin
  select * into m from members
   where shop_id = p_shop_id and name = p_name and birth_date = p_birth limit 1;
  if not found then return null; end if;
  -- 이미 다른 기기·계정이 연결됐고 같은 기기키도 아니면 거부(사칭 방지)
  if m.auth_user_id is not null
     and m.auth_user_id <> auth.uid()
     and m.device_public_key is distinct from p_device then
    raise exception 'already_claimed';
  end if;
  update members
     set auth_user_id = auth.uid(), device_public_key = p_device, status = 'active'
   where id = m.id;
  return m.id;
end $$;
grant execute on function claim_member(uuid, text, text, text) to anon, authenticated;
```

클라이언트(`/m`)는 이미 `already_claimed` 에러를 처리함
([src/app/m/page.tsx](../src/app/m/page.tsx) Identify, `claimMember` 호출부 try/catch).
Supabase 레포의 `claimMember`도 `already_claimed` → 친절한 메시지로 변환하는 코드가 남아 있음.

## 선생님용 "기기 초기화" 재사용

레포 메서드는 이미 있음:
`resetMemberDevice(memberId)` — `device_public_key=null, auth_user_id=null, status='invited'` 로 초기화.
([repositories/types.ts](../src/lib/repositories/types.ts), local/supabase 구현 모두 존재)

UI만 붙이면 됨. 회원 상세([src/app/members/[id]/page.tsx](../src/app/members/[id]/page.tsx)) 헤더에:

```tsx
// member.status === "active" (기기 연결됨)일 때 노출
async function resetDevice() {
  if (!confirm("이 회원의 기기 연결을 초기화할까요? 회원은 이름+생일로 다시 등록해야 합니다."))
    return;
  await repo.resetMemberDevice(id);
  refresh();
}

// 헤더 액션에:
{member.status === "active" && (
  <button onClick={resetDevice} className="text-[13px] font-semibold text-muted hover:text-clay">
    기기 초기화
  </button>
)}
```

초기화 후 그 회원의 기존 기기는 `/m` 진입 시 `status !== "active"` → 세션 해제 → 재인증 요구.

## 참고
- 기기 묶기는 익명 인증 RLS와 함께만 의미가 있음(localStorage 모드는 단일 기기라 무관).
- 사칭 위험을 다른 방식으로 줄이려면: 전화번호 SMS 인증(이름+생일 대신/추가), 또는
  최초 등록 시 선생님 승인 1탭(이전에 토글로 논의된 방식).
