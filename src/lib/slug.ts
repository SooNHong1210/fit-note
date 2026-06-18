// 샵 주소(slug). 선생님이 가입 시 직접 정함. URL: /m/<slug>
// 규칙: 소문자 영문/숫자/하이픈, 3~30자, 하이픈으로 시작·끝 불가.

export function normalizeSlug(s: string): string {
  return s.trim().toLowerCase();
}

export function isValidSlug(s: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/.test(s);
}

export const SLUG_RULE = "소문자 영문·숫자·하이픈(-) 3~30자";
