// localStorage 구현 (멀티 샵). Supabase 설정 없이 즉시 동작(검증용).
//
// 저장 구조:
//   fitnote.shops            → Shop[] (전 샵 레지스트리, 코드 포함)
//   fitnote.shopdata.<id>    → 샵별 데이터 파티션(members/lessons/...)
// 활성 샵은 activeShop 모듈이 관리.

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
import { getActiveShopId, setActiveShopId } from "@/lib/activeShop";
import { normalizeSlug } from "@/lib/slug";
import type { MemberPatch, Repository } from "./types";

const SHOPS_KEY = "fitnote.shops";
const dataKey = (shopId: string) => `fitnote.shopdata.${shopId}`;

interface Partition {
  members: Member[];
  lessons: Lesson[];
  comments: Comment[];
  availability: Availability[];
  bookings: Booking[];
}

function emptyPartition(): Partition {
  return {
    members: [],
    lessons: [],
    comments: [],
    availability: [],
    bookings: [],
  };
}

function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto)
    return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadShops(): Shop[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(SHOPS_KEY) ?? "[]") as Shop[];
  } catch {
    return [];
  }
}

function saveShops(shops: Shop[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SHOPS_KEY, JSON.stringify(shops));
}

function loadData(shopId: string): Partition {
  if (typeof window === "undefined") return emptyPartition();
  try {
    const raw = window.localStorage.getItem(dataKey(shopId));
    if (!raw) return emptyPartition();
    return { ...emptyPartition(), ...(JSON.parse(raw) as Partial<Partition>) };
  } catch {
    return emptyPartition();
  }
}

function saveData(shopId: string, p: Partition): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(dataKey(shopId), JSON.stringify(p));
}

export class LocalRepository implements Repository {
  private shopId(): string {
    const id = getActiveShopId();
    if (!id) throw new Error("활성 샵이 없습니다. 로그인/샵 선택이 필요합니다.");
    return id;
  }
  private hasShop(): boolean {
    return !!getActiveShopId();
  }
  private load(): Partition {
    return loadData(this.shopId());
  }
  private save(p: Partition): void {
    saveData(this.shopId(), p);
  }

  // ---- 샵 ----
  async getShop(): Promise<Shop | null> {
    const id = getActiveShopId();
    if (!id) return null;
    return loadShops().find((s) => s.id === id) ?? null;
  }

  async createShop(name: string, code: string): Promise<Shop> {
    const shops = loadShops();
    const c = normalizeSlug(code);
    if (shops.some((s) => s.code === c))
      throw new Error("이미 사용 중인 주소입니다.");
    const shop: Shop = {
      id: uid(),
      name,
      code: c,
      sessionMinutes: 50,
      advanceLimit: 0,
      createdAt: new Date().toISOString(),
    };
    shops.push(shop);
    saveShops(shops);
    saveData(shop.id, emptyPartition());
    setActiveShopId(shop.id);
    return shop;
  }

  async findShopByCode(code: string): Promise<Shop | null> {
    const c = normalizeSlug(code);
    return loadShops().find((s) => s.code === c) ?? null;
  }

  async setShopCode(code: string): Promise<Shop> {
    const c = normalizeSlug(code);
    const shops = loadShops();
    const id = this.shopId();
    if (shops.some((s) => s.code === c && s.id !== id))
      throw new Error("이미 사용 중인 주소입니다.");
    const idx = shops.findIndex((s) => s.id === id);
    if (idx < 0) throw new Error("shop not found");
    shops[idx] = { ...shops[idx], code: c };
    saveShops(shops);
    return shops[idx];
  }

  async saveShop(input: {
    name: string;
    sessionMinutes: number;
    advanceLimit: number;
  }): Promise<Shop> {
    const shops = loadShops();
    const id = this.shopId();
    const idx = shops.findIndex((s) => s.id === id);
    if (idx < 0) throw new Error("shop not found");
    shops[idx] = { ...shops[idx], ...input };
    saveShops(shops);
    return shops[idx];
  }

  // ---- 회원 ----
  async listMembers(): Promise<Member[]> {
    if (!this.hasShop()) return [];
    return this.load().members.sort((a, b) =>
      a.name.localeCompare(b.name, "ko"),
    );
  }

  async getMember(id: string): Promise<Member | null> {
    if (!this.hasShop()) return null;
    return this.load().members.find((m) => m.id === id) ?? null;
  }

  async createMember(input: NewMember): Promise<Member> {
    const p = this.load();
    const member: Member = {
      ...input,
      status: input.status ?? "invited",
      passTotal: 0,
      passUsed: 0,
      id: uid(),
      createdAt: new Date().toISOString(),
    };
    p.members.push(member);
    this.save(p);
    return member;
  }

  async updateMember(id: string, patch: MemberPatch): Promise<Member> {
    const p = this.load();
    const idx = p.members.findIndex((m) => m.id === id);
    if (idx < 0) throw new Error("member not found");
    p.members[idx] = { ...p.members[idx], ...patch };
    this.save(p);
    return p.members[idx];
  }

  async deleteMember(id: string): Promise<void> {
    const p = this.load();
    p.members = p.members.filter((m) => m.id !== id);
    p.lessons = p.lessons.filter((l) => l.memberId !== id);
    p.comments = p.comments.filter((c) => c.memberId !== id);
    p.bookings = p.bookings.filter((b) => b.memberId !== id);
    this.save(p);
  }

  async findMemberByNameBirth(
    name: string,
    birthDate: string,
  ): Promise<Member | null> {
    if (!this.hasShop()) return null;
    return (
      this.load().members.find(
        (m) => m.name === name.trim() && m.birthDate === birthDate.trim(),
      ) ?? null
    );
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
    const m = await this.findMemberByNameBirth(name, birthDate);
    if (!m) return null;
    return this.claimMemberDevice(m.id, devicePublicKey);
  }

  // ---- 수업 ----
  async listLessons(range?: { from: string; to: string }): Promise<Lesson[]> {
    if (!this.hasShop()) return [];
    let lessons = this.load().lessons;
    if (range)
      lessons = lessons.filter(
        (l) => l.startsAt >= range.from && l.startsAt < range.to,
      );
    return lessons.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }

  async listLessonsByMember(memberId: string): Promise<Lesson[]> {
    if (!this.hasShop()) return [];
    return this.load()
      .lessons.filter((l) => l.memberId === memberId)
      .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  }

  async createLesson(input: NewLesson): Promise<Lesson> {
    const p = this.load();
    const lesson: Lesson = {
      ...input,
      status: input.status ?? "scheduled",
      id: uid(),
      createdAt: new Date().toISOString(),
    };
    p.lessons.push(lesson);
    this.save(p);
    return lesson;
  }

  async updateLesson(
    id: string,
    patch: Partial<Omit<Lesson, "id" | "createdAt">>,
  ): Promise<Lesson> {
    const p = this.load();
    const idx = p.lessons.findIndex((l) => l.id === id);
    if (idx < 0) throw new Error("lesson not found");
    p.lessons[idx] = { ...p.lessons[idx], ...patch };
    this.save(p);
    return p.lessons[idx];
  }

  async deleteLesson(id: string): Promise<void> {
    const p = this.load();
    p.lessons = p.lessons.filter((l) => l.id !== id);
    this.save(p);
  }

  // ---- 코멘트 ----
  async listCommentsByMember(memberId: string): Promise<Comment[]> {
    if (!this.hasShop()) return [];
    return this.load()
      .comments.filter((c) => c.memberId === memberId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async createComment(input: NewComment): Promise<Comment> {
    const p = this.load();
    const comment: Comment = {
      ...input,
      id: uid(),
      createdAt: new Date().toISOString(),
    };
    p.comments.push(comment);
    this.save(p);
    return comment;
  }

  async deleteComment(id: string): Promise<void> {
    const p = this.load();
    p.comments = p.comments.filter((c) => c.id !== id);
    this.save(p);
  }

  // ---- 영업시간 ----
  async listAvailability(): Promise<Availability[]> {
    if (!this.hasShop()) return [];
    return this.load().availability.sort(
      (a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime),
    );
  }

  async setAvailability(list: NewAvailability[]): Promise<Availability[]> {
    const p = this.load();
    p.availability = list.map((a) => ({ ...a, id: uid() }));
    this.save(p);
    return p.availability;
  }

  // ---- 예약 ----
  async listBookings(): Promise<Booking[]> {
    if (!this.hasShop()) return [];
    return this.load().bookings.sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  }

  async listBookingsByMember(memberId: string): Promise<Booking[]> {
    if (!this.hasShop()) return [];
    return this.load()
      .bookings.filter((b) => b.memberId === memberId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async createBooking(input: NewBooking): Promise<Booking> {
    const p = this.load();
    const booking: Booking = {
      ...input,
      status: "requested",
      id: uid(),
      createdAt: new Date().toISOString(),
    };
    p.bookings.push(booking);
    this.save(p);
    return booking;
  }

  async updateBookingStatus(
    id: string,
    status: Booking["status"],
  ): Promise<Booking> {
    const p = this.load();
    const idx = p.bookings.findIndex((b) => b.id === id);
    if (idx < 0) throw new Error("booking not found");
    p.bookings[idx] = {
      ...p.bookings[idx],
      status,
      respondedAt:
        status === "approved" || status === "rejected"
          ? new Date().toISOString()
          : p.bookings[idx].respondedAt,
    };
    this.save(p);
    return p.bookings[idx];
  }

  async markRequestedSeen(): Promise<void> {
    const p = this.load();
    let changed = false;
    p.bookings = p.bookings.map((b) => {
      if (b.status === "requested") {
        changed = true;
        return { ...b, status: "seen" as const };
      }
      return b;
    });
    if (changed) this.save(p);
  }
}
