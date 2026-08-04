// Hisobotlar → O'qituvchilar / Adminstratorlar samaradorligi
// (href /reports-teachers-perf, /reports-admins-perf).
//
// Yangi kolleksiya YO'Q — mavjud buyurtmalardan (lib/ordersData.ts)
// hisoblanadi. Referensdagi jadval uch guruhli sarlavhaga ega:
//   DAVR BOSHIDAGI HOLATI | O'ZGARISHLAR | DAVR OXIRIDAGI HOLATI
// har birida Aktiv / Ketganlar / Bitirganlar / Muzlatilgan.
//
// Hisoblash qoidasi (o'zi bilan izchil):
//   oxiri      = shu odamga tegishli BARCHA buyurtmalar bo'yicha holat
//   o'zgarish  = shulardan tanlangan sana oralig'ida YARATILGANLARI
//   boshi      = oxiri − o'zgarish
// Shunday qilib "boshi + o'zgarish = oxiri" har doim to'g'ri chiqadi.
import type { Order } from "@/lib/ordersData";

export interface StateCounts {
  aktiv: number;
  ketganlar: number;
  bitirganlar: number;
  muzlatilgan: number;
}

export interface PerformanceRow {
  name: string;
  start: StateCounts;
  change: StateCounts;
  end: StateCounts;
}

export const STATE_KEYS: (keyof StateCounts)[] = ["aktiv", "ketganlar", "bitirganlar", "muzlatilgan"];
export const STATE_LABELS: Record<keyof StateCounts, string> = {
  aktiv: "Aktiv",
  ketganlar: "Ketganlar",
  bitirganlar: "Bitirganlar",
  muzlatilgan: "Muzlatilgan",
};

// Buyurtma statusini to'rt holatga moslashtirish.
function bucketOf(o: Order): keyof StateCounts {
  switch (o.status) {
    case "Bekor qilindi":
    case "O'tkazildi":
      return "ketganlar";
    case "Yakunlandi":
      return "bitirganlar";
    case "Kutilmoqda":
      return "muzlatilgan";
    default:
      return "aktiv";
  }
}

function zero(): StateCounts {
  return { aktiv: 0, ketganlar: 0, bitirganlar: 0, muzlatilgan: 0 };
}

// "DD.MM.YYYY | HH:mm" -> Date (kun aniqligida)
function parseCreated(s: string): Date | null {
  const [datePart] = s.split(" ");
  const [d, m, y] = (datePart || "").split(".").map(Number);
  if (!d || !m || !y) return null;
  return new Date(y, m - 1, d);
}

function inRange(d: Date | null, start: Date | null, end: Date | null): boolean {
  if (!d) return false;
  if (start && d < new Date(start.getFullYear(), start.getMonth(), start.getDate())) return false;
  if (end && d > new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59)) return false;
  return true;
}

export function buildPerformanceRows(
  orders: Order[],
  pick: (o: Order) => string,
  range: { start: Date | null; end: Date | null },
): PerformanceRow[] {
  const byName = new Map<string, { end: StateCounts; change: StateCounts }>();

  for (const o of orders) {
    const name = pick(o);
    if (!name) continue;
    if (!byName.has(name)) byName.set(name, { end: zero(), change: zero() });
    const entry = byName.get(name)!;
    const bucket = bucketOf(o);
    entry.end[bucket] += 1;
    // Sana oralig'i tanlanmagan bo'lsa o'zgarish ham bo'lmaydi — jadval
    // referensdagi kabi asosan nollar bilan ko'rinadi.
    if ((range.start || range.end) && inRange(parseCreated(o.created), range.start, range.end)) {
      entry.change[bucket] += 1;
    }
  }

  return Array.from(byName.entries())
    .map(([name, v]) => ({
      name,
      end: v.end,
      change: v.change,
      start: {
        aktiv: v.end.aktiv - v.change.aktiv,
        ketganlar: v.end.ketganlar - v.change.ketganlar,
        bitirganlar: v.end.bitirganlar - v.change.bitirganlar,
        muzlatilgan: v.end.muzlatilgan - v.change.muzlatilgan,
      },
    }))
    .sort((a, b) => b.end.aktiv - a.end.aktiv);
}
