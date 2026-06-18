// 회원권 차감 로직 (순수 함수 — 테스트 대상).
// 차감 시점: 수업 '완료' 처리 시 1회 사용.

import type { Member } from "@/lib/types";

type PassFields = Pick<Member, "passTotal" | "passUsed">;

// 수업 완료 시 다음 사용 횟수. 총 횟수 미설정(0)이거나 소진 시 그대로.
export function nextPassUsedOnDone(member: PassFields): number {
  if (member.passTotal > 0 && member.passUsed < member.passTotal) {
    return member.passUsed + 1;
  }
  return member.passUsed;
}

// 수동 보정: 0 ~ passTotal 범위로 클램프.
export function clampPassUsed(member: PassFields, delta: number): number {
  return Math.min(member.passTotal, Math.max(0, member.passUsed + delta));
}

// 잔여 횟수.
export function passRemaining(member: PassFields): number {
  return Math.max(0, member.passTotal - member.passUsed);
}
