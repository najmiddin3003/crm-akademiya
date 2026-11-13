import { holatOf, type HolatSource } from "@/lib/leadHolat";

// LID MANBALARI HISOBI — yangi versiya «Sozlamalar → Lidlar → Manbalar» (24-qism,
// 13.11.2026; app/api/student-sources?view=leads). Sof funksiyalar — `mongodb` ni
// import qilmaydi (tsx sinovi shu faylni to'g'ridan-to'g'ri chaqiradi).
//
// HAR LID BITTA MANBAGA tushadi (jami = ro'yxatdagi lidlar soni, ikki marta sanalmaydi):
//   1) «Bizni qayerdan bildingiz?» javobi (`heardFrom` — so'rovnoma va bot), "Boshqa" dan
//      boshqa bo'lsa — o'sha (Instagram, Tavsiya …);
//   2) aks holda `source` — kanal ("Sayt so'rovnomasi", "Telegram bot") yoki qo'lda
//      qo'shilgan lidda o'quvchi kartasidagi manba (lib/ordersCreate.ts → pupilSourceFor);
//   3) ikkalasi ham bo'sh — "" («Ko'rsatilmagan»).
// O'quvchiga aylangan = lid holati «Guruhga qo'shildi» (lib/leadHolat.ts → holatOf).

export const OTHER_ANSWER = "Boshqa";

export interface LeadSourceRow extends HolatSource {
  source?: string;
  heardFrom?: string;
}

export interface SourceCount {
  /** Manba nomi; "" — ko'rsatilmagan. */
  name: string;
  leads: number;
  students: number;
}

const txt = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");

/** Lid qaysi manbaga yoziladi (yuqoridagi tartib). */
export function leadManbaOf(o: LeadSourceRow): string {
  const heard = txt(o.heardFrom);
  if (heard && heard !== OTHER_ANSWER) return heard;
  return txt(o.source);
}

/** Manba bo'yicha yig'indi: ko'pi tepada, teng bo'lsa — nom bo'yicha. */
export function countLeadSources(rows: readonly LeadSourceRow[]): { rows: SourceCount[]; total: { leads: number; students: number } } {
  const map = new Map<string, SourceCount>();
  let students = 0;
  for (const o of rows) {
    const name = leadManbaOf(o);
    const cur = map.get(name) ?? { name, leads: 0, students: 0 };
    cur.leads += 1;
    if (holatOf(o) === "guruh") {
      cur.students += 1;
      students += 1;
    }
    map.set(name, cur);
  }
  const out = [...map.values()].sort((a, b) => b.leads - a.leads || a.name.localeCompare(b.name));
  return { rows: out, total: { leads: rows.length, students } };
}

/** Foiz (butun): 9 / 38 → 24. Lid yo'q — null. */
export function conversionPct(students: number, leads: number): number | null {
  if (!leads) return null;
  return Math.round((students / leads) * 100);
}

export type SourcePeriod = "month" | "prev" | "all";

export function isSourcePeriod(v: unknown): v is SourcePeriod {
  return v === "month" || v === "prev" || v === "all";
}

const p2 = (n: number) => String(n).padStart(2, "0");

/**
 * `orders.created` ("13.11.2026 | 17:10", Toshkent vaqti — lib/ordersData.ts →
 * buildOrderFromValues) uchun boshlanish andozasi. `now` — Toshkent "hozir" (uzNow).
 * "all" — null (filtr yo'q).
 */
export function createdPrefixPattern(period: SourcePeriod, now: Date): string | null {
  if (period === "all") return null;
  let y = now.getFullYear();
  let m = now.getMonth() + 1;
  if (period === "prev") {
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  return `^\\d{2}\\.${p2(m)}\\.${y}`;
}

/** Davr chegaralari "YYYY-MM-DD" — sarlavha uchun ("1–13-noyabr"). */
export function periodBounds(period: SourcePeriod, now: Date): { from: string; to: string } | null {
  if (period === "all") return null;
  const y = now.getFullYear();
  const m = now.getMonth();
  if (period === "month") {
    return { from: `${y}-${p2(m + 1)}-01`, to: `${y}-${p2(m + 1)}-${p2(now.getDate())}` };
  }
  const py = m === 0 ? y - 1 : y;
  const pm = m === 0 ? 12 : m;
  const last = new Date(py, pm, 0).getDate();
  return { from: `${py}-${p2(pm)}-01`, to: `${py}-${p2(pm)}-${p2(last)}` };
}

/** "13.11.2026 | 17:10" → { date: "13.11.2026", time: "17:10" }. */
export function splitCreated(created: unknown): { date: string; time: string } | null {
  const m = /^(\d{2}\.\d{2}\.\d{4})\s*\|\s*(\d{2}:\d{2})/.exec(txt(created));
  return m ? { date: m[1], time: m[2] } : null;
}

/** Toshkent "bugun" — `orders.created` dagi sana shaklida ("13.11.2026"). */
export function createdDay(now: Date): string {
  return `${p2(now.getDate())}.${p2(now.getMonth() + 1)}.${now.getFullYear()}`;
}
