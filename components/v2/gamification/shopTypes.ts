import type { ShopItemView } from "@/components/gamification/shop/ShopModals";

// YANGI VERSIYA — DO'KON ma'lumot tiplari (GET /api/gamification/shop va
// /api/gamification/shop/requests javoblari; lib/gamification/shop.ts, shopRequests.ts).

export interface ReqRow {
  key: string;
  pupilId: number;
  pupilName: string;
  groupLabel: string;
  itemId: number;
  title: string;
  name: string;
  kind: "item" | "service" | "discount";
  imageUrl: string | null;
  emoji: string;
  price: number;
  stockLeft: number | null;
  balance: number;
  after: number;
  /** ISO vaqt yoki "YYYY-MM-DD" (eski istaklar — soatsiz). */
  requestedAt: string;
  /** Berib bo'lmaslik sababi (ombor, byudjet …) — «Tasdiqlash» o'chiq. */
  error: string | null;
}

export interface AwaitRow {
  orderId: number;
  pupilId: number;
  pupilName: string;
  groupLabel: string;
  itemId: number;
  title: string;
  name: string;
  kind: "item" | "service" | "discount";
  imageUrl: string | null;
  emoji: string;
  price: number;
  stockLeft: number | null;
  approvedAt: string;
  approvedByName: string;
  branchName: string;
  givenDate: string;
  canReturn: boolean;
}

export interface ReqView {
  enabled: boolean;
  role: "director" | "branch_admin" | "teacher";
  canManage: boolean;
  branches: { id: number; name: string }[];
  requests: ReqRow[];
  waiting: number;
  awaiting: AwaitRow[];
}

export interface ShopData {
  enabled: boolean;
  role: "director" | "branch_admin" | "teacher";
  month: string;
  kidsMaxGrade: number;
  branchOptions: { id: number; name: string }[];
  items: ShopItemView[];
  budget: { branchId: number; name: string; spent: number; limit: number | null; left: number | null }[];
}

export interface HistoryRow {
  key: string;
  kind: "order" | "rejection";
  id: number;
  pupilId: number;
  pupilName: string;
  title: string;
  itemKind: "item" | "service" | "discount";
  price: number;
  status: "handed" | "given" | "returned" | "rejected";
  at: string;
  byName: string;
  note: string | null;
  branchName: string;
  givenDate: string;
  canReturn: boolean;
}

/** Ombor qoldig'i — so'rovlar doirasidagi binolar bo'yicha (buyum emas — null). */
export function stockInScope(item: ShopItemView, branchIds: number[]): number | null {
  if (item.kind !== "item") return null;
  const src = item.stockAll ?? item.stock;
  if (!src) return null;
  const ids = branchIds.length ? branchIds.map(String) : Object.keys(src);
  return ids.reduce((s, b) => s + (Number(src[b]) || 0), 0);
}
