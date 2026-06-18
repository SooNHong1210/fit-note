// 현재 활성 샵 ID (멀티 테넌시 스코프 키).
// 선생님은 로그인 시 자기 샵으로, 회원은 샵 코드 입력 시 해당 샵으로 설정됨.
// 같은 브라우저에서 두 역할을 동시에 쓰면 충돌할 수 있으므로, 각 진입점
// (선생님 게이트 / 회원 앱)에서 마운트 시 자기 샵으로 재설정한다.

const KEY = "fitnote.activeShop";
let cache: string | null = null;

export function getActiveShopId(): string | null {
  if (cache) return cache;
  if (typeof window === "undefined") return null;
  cache = window.localStorage.getItem(KEY);
  return cache;
}

export function setActiveShopId(id: string): void {
  cache = id;
  if (typeof window !== "undefined") window.localStorage.setItem(KEY, id);
}

export function clearActiveShop(): void {
  cache = null;
  if (typeof window !== "undefined") window.localStorage.removeItem(KEY);
}

// 6자리 샵 코드 (회원에게 공유)
export function generateShopCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++)
    code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}
