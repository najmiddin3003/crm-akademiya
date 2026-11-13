// TO'LOV TURLARI VA KASSALAR — SOZLAMALAR SAHIFALARI UCHUN SOF YORDAMCHILAR (24-qism,
// «Sozlamalar · Kassalar» va «Sozlamalar · To'lov turlari», 13.11.2026).
//
// Bazaga ham, React'ga ham bog'liq emas: route (app/api/payment-methods) va ikkala sahifa
// (components/v2/settings/CashboxSettingsV2.tsx, PaymentMethodsV2.tsx) shu qoidalardan oladi,
// sinovlari — npx tsx bilan.
//
// «QAYSI KASSA QAYSI TURNI QABUL QILADI» — tizimda bunday SOZLAMA YO'Q: to'lov oynasi har
// kassaga barcha faol turlarni ko'rsatadi. Sahifalarda ko'rsatiladigani — HAQIQIY ishlatilish:
// oxirgi USAGE_DAYS kunda shu kassaga shu tur bilan tushum (payIn, bekor qilinmagan,
// tasdiq kutmayotgan) yozilganmi. Bu cheklov emas, kuzatuv.

/** Ishlatilish oynasi, kun. */
export const USAGE_DAYS = 90;

/** Doim birinchi turadigan va o'chirilmaydigan tur — kassa hisobining asosi. */
export const PINNED_METHOD_KEY = "naqd";

/**
 * Nofaol qilib bo'lmaydigan turlar:
 *   • naqd — kassa hisobining asosi, oylikning naqd qismi;
 *   • plastik — oylikning karta qismi shu kalit bilan o'lchanadi (lib/paymentMethods.ts
 *     PLASTIK_METHOD_KEY, lib/payrollSources.ts).
 */
export const LOCKED_METHOD_KEYS: readonly string[] = ["naqd", "plastik"];

export function isLockedMethod(key: string): boolean {
  return LOCKED_METHOD_KEYS.includes(key);
}

interface Orderable {
  id: number;
  key: string;
  order?: number | null;
}

/**
 * Ko'rsatish tartibi: «naqd» doim birinchi, so'ng `order` (Sozlamalarda surib qo'yilgan),
 * `order`i yo'qlar (yangi qo'shilgan) — oxirida, teng bo'lsa `id` bo'yicha. Hech kim surmagan
 * bo'lsa tartib avvalgidek — `id` bo'yicha.
 */
export function sortPaymentMethods<T extends Orderable>(list: readonly T[]): T[] {
  const rank = (m: T) => (m.key === PINNED_METHOD_KEY ? -1 : typeof m.order === "number" && Number.isFinite(m.order) ? m.order : Number.MAX_SAFE_INTEGER);
  return [...list].sort((a, b) => rank(a) - rank(b) || a.id - b.id);
}

/** Ro'yxatda bitta elementni `from` dan `to` ga ko'chiradi (yangi massiv). */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= list.length) return [...list];
  const out = [...list];
  const [item] = out.splice(from, 1);
  out.splice(Math.max(0, Math.min(to, out.length)), 0, item);
  return out;
}

/**
 * Surib qo'yilgan yangi tartib to'g'rimi: mavjud turlarning HAR BIRI bir martadan, ortiqchasiz
 * va «naqd» (bo'lsa) birinchi. Aks holda — ro'yxat boshqa oynada o'zgargan (yangi tur qo'shilgan).
 */
export function isValidOrder(existing: readonly { id: number; key: string }[], ids: readonly number[]): boolean {
  if (ids.length !== existing.length) return false;
  const known = new Set(existing.map((m) => m.id));
  const seen = new Set<number>();
  for (const id of ids) {
    if (!Number.isInteger(id) || !known.has(id) || seen.has(id)) return false;
    seen.add(id);
  }
  const pinned = existing.find((m) => m.key === PINNED_METHOD_KEY);
  return !pinned || ids[0] === pinned.id;
}

/** "YYYY-MM-DD" dan `days` kun oldingi sana (UTC kalendari bo'yicha — vaqt mintaqasi siljimaydi). */
export function isoDaysBefore(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  dt.setUTCDate(dt.getUTCDate() - days);
  return dt.toISOString().slice(0, 10);
}

/** Bitta kassa × tur bo'yicha tushumlar soni (aggregatsiya natijasi). */
export interface UsageRow {
  cashboxId: number;
  key: string;
  count: number;
}

/** Tur kaliti → shu turda tushum olgan kassalar (eng ko'p ishlatgani birinchi). */
export type MethodUsage = Record<string, { cashboxId: number; count: number }[]>;

export function buildMethodUsage(rows: readonly UsageRow[]): MethodUsage {
  const out: MethodUsage = {};
  for (const r of rows) {
    // Kassasiz yozuv (cashboxId yo'q → 0/NaN) sanalmaydi — kassa raqamlari 1 dan.
    if (!r.key || !Number.isInteger(r.cashboxId) || r.cashboxId <= 0 || !(r.count > 0)) continue;
    const list = (out[r.key] ??= []);
    const cur = list.find((x) => x.cashboxId === r.cashboxId);
    if (cur) cur.count += r.count;
    else list.push({ cashboxId: r.cashboxId, count: r.count });
  }
  for (const list of Object.values(out)) list.sort((a, b) => b.count - a.count || a.cashboxId - b.cashboxId);
  return out;
}

/** Kassa oxirgi davrda qabul qilgan turlar — berilgan tartibda (sortPaymentMethods natijasi). */
export function methodsOfCashbox<M extends { key: string }>(usage: MethodUsage, cashboxId: number, methods: readonly M[]): M[] {
  return methods.filter((m) => (usage[m.key] ?? []).some((u) => u.cashboxId === cashboxId));
}

/**
 * Turning «qabul qilgan kassalar» katagi: hammasimi, nechtasi, qaysilari.
 * `activeIds` — arxivda bo'lmagan kassalar; arxivdagi kassa ham sanaladi (tarixda bor),
 * lekin «hamma kassalarda» faqat barcha FAOL kassalar qamralganda.
 */
export function cashboxCoverage(usage: MethodUsage, key: string, activeIds: readonly number[]): { ids: number[]; all: boolean } {
  const ids = (usage[key] ?? []).map((u) => u.cashboxId);
  const all = activeIds.length > 1 && activeIds.every((id) => ids.includes(id));
  return { ids, all };
}

/** Kassa qoldig'i va kutilayotgan ko'chirmalar — arxivga o'tkazishdan oldin bo'shmi. */
export function cashboxBlocksArchive(c: {
  balance?: number;
  pendingOut?: Record<string, number>;
  pendingInCount?: number;
}): "balance" | "pending" | null {
  if (Math.round(Number(c.balance) || 0) !== 0) return "balance";
  const out = Object.values(c.pendingOut ?? {}).reduce((s, v) => s + (Number(v) || 0), 0);
  if (out > 0 || (c.pendingInCount ?? 0) > 0) return "pending";
  return null;
}

/** «Najmiddin Azizov» → «NA». */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
