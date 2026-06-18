// Supabase 구현 (멀티 샵). 모든 데이터는 shop_id로 활성 샵에 스코프.
// 선생님 격리는 RLS(owner_id)로 보장. (회원/anon 접근 RLS는 후속 작업)

import { getSupabase } from "@/lib/supabaseClient";
import { getActiveShopId, setActiveShopId } from "@/lib/activeShop";
import { normalizeSlug } from "@/lib/slug";
import type {
  Availability,
  Booking,
  Comment,
  Lesson,
  Member,
  NewAvailability,
  NewBooking,
  NewComment,
  NewLesson,
  NewMember,
  Shop,
} from "@/lib/types";
import type { MemberPatch, Repository } from "./types";

type MemberRow = {
  id: string;
  name: string;
  birth_date: string | null;
  phone: string | null;
  device_public_key: string | null;
  status: Member["status"];
  pass_total: number;
  pass_used: number;
  created_at: string;
};
type LessonRow = {
  id: string;
  member_id: string;
  starts_at: string;
  ends_at: string;
  status: Lesson["status"];
  created_at: string;
};
type CommentRow = {
  id: string;
  member_id: string;
  lesson_id: string | null;
  text: string;
  created_at: string;
};
type ShopRow = {
  id: string;
  name: string;
  code: string;
  session_minutes: number;
  advance_limit: number;
  created_at: string;
};
type AvailabilityRow = {
  id: string;
  weekday: number;
  start_time: string;
  end_time: string;
};
type BookingRow = {
  id: string;
  member_id: string;
  slot_starts_at: string;
  slot_ends_at: string;
  status: Booking["status"];
  created_at: string;
  responded_at: string | null;
};

const toMember = (r: MemberRow): Member => ({
  id: r.id,
  name: r.name,
  birthDate: r.birth_date ?? undefined,
  phone: r.phone ?? undefined,
  devicePublicKey: r.device_public_key ?? undefined,
  status: r.status,
  passTotal: r.pass_total ?? 0,
  passUsed: r.pass_used ?? 0,
  createdAt: r.created_at,
});
const toLesson = (r: LessonRow): Lesson => ({
  id: r.id,
  memberId: r.member_id,
  startsAt: r.starts_at,
  endsAt: r.ends_at,
  status: r.status,
  createdAt: r.created_at,
});
const toComment = (r: CommentRow): Comment => ({
  id: r.id,
  memberId: r.member_id,
  lessonId: r.lesson_id ?? undefined,
  text: r.text,
  createdAt: r.created_at,
});
const toShop = (r: ShopRow): Shop => ({
  id: r.id,
  name: r.name,
  code: r.code,
  sessionMinutes: r.session_minutes,
  advanceLimit: r.advance_limit ?? 0,
  createdAt: r.created_at,
});
const toAvailability = (r: AvailabilityRow): Availability => ({
  id: r.id,
  weekday: r.weekday,
  startTime: r.start_time,
  endTime: r.end_time,
});
const toBooking = (r: BookingRow): Booking => ({
  id: r.id,
  memberId: r.member_id,
  slotStartsAt: r.slot_starts_at,
  slotEndsAt: r.slot_ends_at,
  status: r.status,
  createdAt: r.created_at,
  respondedAt: r.responded_at ?? undefined,
});

export class SupabaseRepository implements Repository {
  private sid(): string {
    const id = getActiveShopId();
    if (!id) throw new Error("활성 샵이 없습니다.");
    return id;
  }
  private hasShop(): boolean {
    return !!getActiveShopId();
  }

  // ---- 샵 ----
  async getShop(): Promise<Shop | null> {
    const id = getActiveShopId();
    if (!id) return null;
    const { data, error } = await getSupabase()
      .from("shops")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? toShop(data as ShopRow) : null;
  }

  async createShop(name: string, code: string): Promise<Shop> {
    const sb = getSupabase();
    const c = normalizeSlug(code);
    if (await this.findShopByCode(c))
      throw new Error("이미 사용 중인 주소입니다.");
    const {
      data: { user },
    } = await sb.auth.getUser();
    const { data, error } = await sb
      .from("shops")
      .insert({ name, code: c, owner_id: user?.id ?? null })
      .select("*")
      .single();
    if (error) {
      if ((error as { code?: string }).code === "23505")
        throw new Error("이미 사용 중인 주소입니다.");
      throw error;
    }
    const shop = toShop(data as ShopRow);
    setActiveShopId(shop.id);
    return shop;
  }

  async findShopByCode(code: string): Promise<Shop | null> {
    const { data, error } = await getSupabase()
      .from("shops")
      .select("*")
      .eq("code", normalizeSlug(code))
      .maybeSingle();
    if (error) throw error;
    return data ? toShop(data as ShopRow) : null;
  }

  async setShopCode(code: string): Promise<Shop> {
    const c = normalizeSlug(code);
    const existing = await this.findShopByCode(c);
    if (existing && existing.id !== this.sid())
      throw new Error("이미 사용 중인 주소입니다.");
    const { data, error } = await getSupabase()
      .from("shops")
      .update({ code: c })
      .eq("id", this.sid())
      .select("*")
      .single();
    if (error) {
      if ((error as { code?: string }).code === "23505")
        throw new Error("이미 사용 중인 주소입니다.");
      throw error;
    }
    return toShop(data as ShopRow);
  }

  async saveShop(input: {
    name: string;
    sessionMinutes: number;
    advanceLimit: number;
  }): Promise<Shop> {
    const { data, error } = await getSupabase()
      .from("shops")
      .update({
        name: input.name,
        session_minutes: input.sessionMinutes,
        advance_limit: input.advanceLimit,
      })
      .eq("id", this.sid())
      .select("*")
      .single();
    if (error) throw error;
    return toShop(data as ShopRow);
  }

  // ---- 회원 ----
  async listMembers(): Promise<Member[]> {
    if (!this.hasShop()) return [];
    const { data, error } = await getSupabase()
      .from("members")
      .select("*")
      .eq("shop_id", this.sid())
      .order("name");
    if (error) throw error;
    return (data as MemberRow[]).map(toMember);
  }

  async getMember(id: string): Promise<Member | null> {
    const { data, error } = await getSupabase()
      .from("members")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? toMember(data as MemberRow) : null;
  }

  async createMember(input: NewMember): Promise<Member> {
    const { data, error } = await getSupabase()
      .from("members")
      .insert({
        shop_id: this.sid(),
        name: input.name,
        birth_date: input.birthDate ?? null,
        phone: input.phone ?? null,
        status: input.status ?? "invited",
      })
      .select("*")
      .single();
    if (error) throw error;
    return toMember(data as MemberRow);
  }

  async updateMember(id: string, patch: MemberPatch): Promise<Member> {
    const { data, error } = await getSupabase()
      .from("members")
      .update({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.birthDate !== undefined ? { birth_date: patch.birthDate } : {}),
        ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
        ...(patch.devicePublicKey !== undefined
          ? { device_public_key: patch.devicePublicKey }
          : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.passTotal !== undefined ? { pass_total: patch.passTotal } : {}),
        ...(patch.passUsed !== undefined ? { pass_used: patch.passUsed } : {}),
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return toMember(data as MemberRow);
  }

  async deleteMember(id: string): Promise<void> {
    const { error } = await getSupabase().from("members").delete().eq("id", id);
    if (error) throw error;
  }

  async findMemberByNameBirth(
    name: string,
    birthDate: string,
  ): Promise<Member | null> {
    if (!this.hasShop()) return null;
    const { data, error } = await getSupabase()
      .from("members")
      .select("*")
      .eq("shop_id", this.sid())
      .eq("name", name.trim())
      .eq("birth_date", birthDate.trim())
      .maybeSingle();
    if (error) throw error;
    return data ? toMember(data as MemberRow) : null;
  }

  async claimMemberDevice(memberId: string, publicKey: string): Promise<Member> {
    return this.updateMember(memberId, {
      devicePublicKey: publicKey,
      status: "active",
    });
  }

  async claimMember(
    name: string,
    birthDate: string,
    devicePublicKey: string,
  ): Promise<Member | null> {
    const sb = getSupabase();
    // 회원은 익명 인증 세션이 필요(RLS 스코프)
    const {
      data: { session },
    } = await sb.auth.getSession();
    if (!session) {
      const { error: authErr } = await sb.auth.signInAnonymously();
      if (authErr) throw authErr;
    }
    const { data, error } = await sb.rpc("claim_member", {
      p_shop_id: this.sid(),
      p_name: name.trim(),
      p_birth: birthDate.trim(),
      p_device: devicePublicKey,
    });
    if (error) {
      if (String(error.message).includes("already_claimed"))
        throw new Error("이미 다른 기기에 연결된 회원입니다. 선생님께 문의하세요.");
      throw error;
    }
    if (!data) return null; // 등록된 회원 아님
    return this.getMember(data as string);
  }

  // ---- 수업 ----
  async listLessons(range?: { from: string; to: string }): Promise<Lesson[]> {
    if (!this.hasShop()) return [];
    let q = getSupabase()
      .from("lessons")
      .select("*")
      .eq("shop_id", this.sid())
      .order("starts_at");
    if (range) q = q.gte("starts_at", range.from).lt("starts_at", range.to);
    const { data, error } = await q;
    if (error) throw error;
    return (data as LessonRow[]).map(toLesson);
  }

  async listLessonsByMember(memberId: string): Promise<Lesson[]> {
    const { data, error } = await getSupabase()
      .from("lessons")
      .select("*")
      .eq("member_id", memberId)
      .order("starts_at", { ascending: false });
    if (error) throw error;
    return (data as LessonRow[]).map(toLesson);
  }

  async createLesson(input: NewLesson): Promise<Lesson> {
    const { data, error } = await getSupabase()
      .from("lessons")
      .insert({
        shop_id: this.sid(),
        member_id: input.memberId,
        starts_at: input.startsAt,
        ends_at: input.endsAt,
        status: input.status ?? "scheduled",
      })
      .select("*")
      .single();
    if (error) throw error;
    return toLesson(data as LessonRow);
  }

  async updateLesson(
    id: string,
    patch: Partial<Omit<Lesson, "id" | "createdAt">>,
  ): Promise<Lesson> {
    const { data, error } = await getSupabase()
      .from("lessons")
      .update({
        ...(patch.memberId !== undefined ? { member_id: patch.memberId } : {}),
        ...(patch.startsAt !== undefined ? { starts_at: patch.startsAt } : {}),
        ...(patch.endsAt !== undefined ? { ends_at: patch.endsAt } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return toLesson(data as LessonRow);
  }

  async deleteLesson(id: string): Promise<void> {
    const { error } = await getSupabase().from("lessons").delete().eq("id", id);
    if (error) throw error;
  }

  // ---- 코멘트 ----
  async listCommentsByMember(memberId: string): Promise<Comment[]> {
    const { data, error } = await getSupabase()
      .from("comments")
      .select("*")
      .eq("member_id", memberId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data as CommentRow[]).map(toComment);
  }

  async createComment(input: NewComment): Promise<Comment> {
    const { data, error } = await getSupabase()
      .from("comments")
      .insert({
        shop_id: this.sid(),
        member_id: input.memberId,
        lesson_id: input.lessonId ?? null,
        text: input.text,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toComment(data as CommentRow);
  }

  async deleteComment(id: string): Promise<void> {
    const { error } = await getSupabase().from("comments").delete().eq("id", id);
    if (error) throw error;
  }

  // ---- 영업시간 ----
  async listAvailability(): Promise<Availability[]> {
    if (!this.hasShop()) return [];
    const { data, error } = await getSupabase()
      .from("availability")
      .select("*")
      .eq("shop_id", this.sid())
      .order("weekday")
      .order("start_time");
    if (error) throw error;
    return (data as AvailabilityRow[]).map(toAvailability);
  }

  async setAvailability(list: NewAvailability[]): Promise<Availability[]> {
    const sb = getSupabase();
    const shopId = this.sid();
    const { error: delErr } = await sb
      .from("availability")
      .delete()
      .eq("shop_id", shopId);
    if (delErr) throw delErr;
    if (list.length === 0) return [];
    const { data, error } = await sb
      .from("availability")
      .insert(
        list.map((a) => ({
          shop_id: shopId,
          weekday: a.weekday,
          start_time: a.startTime,
          end_time: a.endTime,
        })),
      )
      .select("*");
    if (error) throw error;
    return (data as AvailabilityRow[]).map(toAvailability);
  }

  // ---- 예약 ----
  async listBookings(): Promise<Booking[]> {
    if (!this.hasShop()) return [];
    const { data, error } = await getSupabase()
      .from("bookings")
      .select("*")
      .eq("shop_id", this.sid())
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data as BookingRow[]).map(toBooking);
  }

  async listBookingsByMember(memberId: string): Promise<Booking[]> {
    const { data, error } = await getSupabase()
      .from("bookings")
      .select("*")
      .eq("member_id", memberId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data as BookingRow[]).map(toBooking);
  }

  async createBooking(input: NewBooking): Promise<Booking> {
    const { data, error } = await getSupabase()
      .from("bookings")
      .insert({
        shop_id: this.sid(),
        member_id: input.memberId,
        slot_starts_at: input.slotStartsAt,
        slot_ends_at: input.slotEndsAt,
        status: "requested",
      })
      .select("*")
      .single();
    if (error) throw error;
    return toBooking(data as BookingRow);
  }

  async updateBookingStatus(
    id: string,
    status: Booking["status"],
  ): Promise<Booking> {
    const responded =
      status === "approved" || status === "rejected"
        ? { responded_at: new Date().toISOString() }
        : {};
    const { data, error } = await getSupabase()
      .from("bookings")
      .update({ status, ...responded })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return toBooking(data as BookingRow);
  }

  async markRequestedSeen(): Promise<void> {
    const { error } = await getSupabase()
      .from("bookings")
      .update({ status: "seen" })
      .eq("shop_id", this.sid())
      .eq("status", "requested");
    if (error) throw error;
  }
}
