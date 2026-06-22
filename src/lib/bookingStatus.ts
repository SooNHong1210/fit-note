import type { BookingStatus } from "@/lib/types";

// 회원에게 보여줄 상태 라벨 (SPEC 4.2: 신청됨 → 확인 중 → 승인/거절)
export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  requested: "신청됨",
  seen: "선생님 확인 중",
  approved: "승인됨",
  rejected: "거절됨",
  canceled: "취소됨",
};

export const BOOKING_STATUS_CLASS: Record<BookingStatus, string> = {
  requested: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  seen: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  approved: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
  rejected: "bg-black/10 text-black/50 dark:bg-white/10 dark:text-white/50",
  canceled: "bg-black/10 text-black/50 dark:bg-white/10 dark:text-white/50",
};
