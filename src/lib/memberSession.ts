// 회원 기기 신원 & 세션 (클라이언트 전용).
// MVP: 기기 키쌍 대신 랜덤 publicKey 문자열을 기기에 저장(=기기 신원).
// SPEC의 키쌍 생성은 Stage 2(WebRTC/E2E) 또는 보안 강화 시 도입.

const DEVICE_KEY = "reservation.devicePublicKey";
const SESSION_KEY = "reservation.memberId";
const SHOP_KEY = "fitnote.memberShopId";

// 회원이 선택한 샵 ID (가입 코드/링크로 정해짐)
export function getMemberShopId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(SHOP_KEY);
}

export function setMemberShopId(shopId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SHOP_KEY, shopId);
}

export function clearMemberShopId(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SHOP_KEY);
}

export function getDevicePublicKey(): string {
  if (typeof window === "undefined") return "";
  let key = window.localStorage.getItem(DEVICE_KEY);
  if (!key) {
    key =
      "dev_" +
      (crypto?.randomUUID?.() ??
        `${Date.now()}-${Math.random().toString(16).slice(2)}`);
    window.localStorage.setItem(DEVICE_KEY, key);
  }
  return key;
}

export function getSessionMemberId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(SESSION_KEY);
}

export function setSessionMemberId(memberId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SESSION_KEY, memberId);
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_KEY);
}
