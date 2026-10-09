// SUHBATLAR TARIXI — to'liq ekrandagi chap ro'yxat uchun sof yordamchilar
// (08.10.2026). Ro'yxat GET /api/ai/conversations?list=1 dan keladi
// (faqat o'z suhbatlari, 30 kun saqlanadi — lib/ai/store.ts); bu yerda —
// sana bo'yicha guruhlash (ChatGPT'dagi kabi) va javob saqlangandan keyin
// ro'yxatni joyida yangilash. scripts/_verify-ai.mjs sinaydi.

export interface AiHistoryItem {
  id: string;
  title: string;
  /** ISO vaqt — oxirgi xabar. */
  updatedAt: string;
}

export type HistoryGroup = "today" | "yesterday" | "week" | "month" | "older";

/** Guruh sarlavhalari (`label:` — i18n skaneri shundan taniydi). */
export const HISTORY_GROUPS: { group: HistoryGroup; label: string }[] = [
  { group: "today", label: "Bugun" },
  { group: "yesterday", label: "Kecha" },
  { group: "week", label: "Oxirgi 7 kun" },
  { group: "month", label: "Oxirgi 30 kun" },
  { group: "older", label: "Oldinroq" },
];

const DAY_MS = 86_400_000;

/**
 * Sana bo'yicha guruhlar — qurilmaning mahalliy kuni bilan (xodim
 * Toshkentda). Bo'sh guruh qaytmaydi; har guruh ichida tartib o'zgarmaydi
 * (server yangisidan eskisiga beradi).
 */
export function groupHistory<T extends { updatedAt: string }>(items: T[], now: Date): { group: HistoryGroup; items: T[] }[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const groupOf = (iso: string): HistoryGroup => {
    const at = Date.parse(iso);
    if (!Number.isFinite(at) || at >= today) return "today";
    if (at >= today - DAY_MS) return "yesterday";
    if (at >= today - 6 * DAY_MS) return "week";
    if (at >= today - 29 * DAY_MS) return "month";
    return "older";
  };
  const buckets = new Map<HistoryGroup, T[]>();
  for (const it of items) {
    const g = groupOf(it.updatedAt);
    const list = buckets.get(g);
    if (list) list.push(it);
    else buckets.set(g, [it]);
  }
  return HISTORY_GROUPS.filter((g) => buckets.has(g.group)).map((g) => ({ group: g.group, items: buckets.get(g.group) ?? [] }));
}

/** Suhbat nomi — server bilan bir xil (lib/ai/store.ts `saveTurn`: birinchi savolning 80 belgisi). */
export function historyTitle(question: string): string {
  return question.replace(/\s+/g, " ").trim().slice(0, 80);
}

/**
 * Javob saqlandi — suhbat ro'yxat tepasiga chiqadi. Yangisi qo'shiladi;
 * eskisining nomi o'zgarmaydi (server ham birinchi savol nomini saqlaydi).
 * Ro'yxat hali yuklanmagan bo'lsa (`null`) — tegilmaydi, server o'zi beradi.
 */
export function touchHistory(list: AiHistoryItem[] | null, id: string, question: string, at: string): AiHistoryItem[] | null {
  if (!list || !id) return list;
  const old = list.find((x) => x.id === id);
  return [{ id, title: old?.title || historyTitle(question), updatedAt: at }, ...list.filter((x) => x.id !== id)];
}

/** Qidiruv — nom bo'yicha, katta-kichik harf va apostrof turlarisiz. */
export function filterHistory<T extends { title: string }>(items: T[], query: string): T[] {
  const norm = (s: string) => s.toLowerCase().replace(/[‘’ʻʼ`´]/g, "'").replace(/\s+/g, " ").trim();
  const q = norm(query);
  return q ? items.filter((x) => norm(x.title).includes(q)) : items;
}
