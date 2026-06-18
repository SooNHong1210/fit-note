// 선생님 인증. Supabase 설정 시 Supabase Auth, 아니면 localStorage 계정(데모).
// ⚠️ 로컬 계정은 비밀번호를 평문 저장하는 데모용입니다. 실제 보안은 Supabase Auth.

import { getRepository } from "@/lib/repositories";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { clearActiveShop, setActiveShopId } from "@/lib/activeShop";

export interface AuthApi {
  current(): Promise<{ shopName: string } | null>;
  signUp(
    email: string,
    password: string,
    shopName: string,
    slug: string,
  ): Promise<void>;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  // 비밀번호 찾기. Supabase: 재설정 메일 발송({emailed:true}).
  //               local: newPassword로 즉시 재설정(데모, {emailed:false}).
  requestReset(
    email: string,
    newPassword?: string,
  ): Promise<{ emailed: boolean }>;
}

// ---------- 로컬 계정 ----------
const ACCOUNTS_KEY = "fitnote.accounts";
const CURRENT_KEY = "fitnote.currentAccount";

interface LocalAccount {
  email: string;
  password: string;
  shopId: string;
}

function loadAccounts(): LocalAccount[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(
      window.localStorage.getItem(ACCOUNTS_KEY) ?? "[]",
    ) as LocalAccount[];
  } catch {
    return [];
  }
}
function saveAccounts(a: LocalAccount[]): void {
  window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(a));
}

const localAuth: AuthApi = {
  async current() {
    if (typeof window === "undefined") return null;
    const email = window.localStorage.getItem(CURRENT_KEY);
    if (!email) return null;
    const acc = loadAccounts().find((a) => a.email === email);
    if (!acc) return null;
    setActiveShopId(acc.shopId);
    const shop = await getRepository().getShop();
    return { shopName: shop?.name ?? "내 샵" };
  },
  async signUp(email, password, shopName, slug) {
    email = email.trim().toLowerCase();
    const accounts = loadAccounts();
    if (accounts.some((a) => a.email === email))
      throw new Error("이미 가입된 이메일입니다.");
    const shop = await getRepository().createShop(
      shopName.trim() || "내 샵",
      slug,
    );
    accounts.push({ email, password, shopId: shop.id });
    saveAccounts(accounts);
    window.localStorage.setItem(CURRENT_KEY, email);
  },
  async signIn(email, password) {
    email = email.trim().toLowerCase();
    const acc = loadAccounts().find(
      (a) => a.email === email && a.password === password,
    );
    if (!acc) throw new Error("이메일 또는 비밀번호가 올바르지 않습니다.");
    setActiveShopId(acc.shopId);
    window.localStorage.setItem(CURRENT_KEY, email);
  },
  async signOut() {
    if (typeof window !== "undefined")
      window.localStorage.removeItem(CURRENT_KEY);
    clearActiveShop();
  },
  async requestReset(email, newPassword) {
    email = email.trim().toLowerCase();
    if (!newPassword || newPassword.length < 6)
      throw new Error("새 비밀번호(6자 이상)를 입력하세요.");
    const accounts = loadAccounts();
    const acc = accounts.find((a) => a.email === email);
    if (!acc) throw new Error("가입된 이메일이 아닙니다.");
    acc.password = newPassword;
    saveAccounts(accounts);
    return { emailed: false };
  },
};

// ---------- Supabase Auth ----------
const supabaseAuth: AuthApi = {
  async current() {
    const sb = getSupabase();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) return null;
    const { data } = await sb
      .from("shops")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at")
      .limit(1)
      .maybeSingle();
    if (!data) return null;
    setActiveShopId(data.id);
    return { shopName: data.name };
  },
  async signUp(email, password, shopName, slug) {
    const sb = getSupabase();
    const { error } = await sb.auth.signUp({
      email: email.trim(),
      password,
    });
    if (error) throw error;
    await getRepository().createShop(shopName.trim() || "내 샵", slug);
  },
  async signIn(email, password) {
    const sb = getSupabase();
    const { error } = await sb.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw error;
    await supabaseAuth.current(); // 활성 샵 설정
  },
  async signOut() {
    await getSupabase().auth.signOut();
    clearActiveShop();
  },
  async requestReset(email) {
    const redirectTo =
      typeof window !== "undefined" ? `${window.location.origin}/reset` : undefined;
    const { error } = await getSupabase().auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo },
    );
    if (error) throw error;
    return { emailed: true };
  },
};

export function getAuth(): AuthApi {
  return isSupabaseConfigured ? supabaseAuth : localAuth;
}
