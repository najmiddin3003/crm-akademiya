import { GROUP_SEED } from "@/constants/groups";
import type { Order } from "./ordersData";

// O'quvchilar → Arxiv o'quvchilar sahifasi uchun qo'shimcha maydonlar.
//
// Referens jadvalida arxivga xos ustunlar bor (`Arxivlangan guruh`,
// `Arxiv o'qituvchisi`, `Pro arxivlangan sana`, `Arxivlangan sana`,
// `Oldingi holati`), lekin buyurtma modelida bu maydonlar yo'q. Loyihadagi
// odat bo'yicha ular `order.id` dan DETERMINISTIK hisoblanadi — sahifa har
// ochilganda bir xil natija chiqadi va o'quvchi doim bitta haqiqiy guruhga
// bog'lanadi (`GROUP_SEED`). Backend haqiqiy qiymatlarni bergach, shu
// funksiyalar o'rniga o'sha qiymatlar ishlatiladi.

interface SeedGroup {
  id: number;
  name: string;
  teacher?: string;
}

const GROUPS = GROUP_SEED as SeedGroup[];

export interface ArchiveExtras {
  group: string;
  teacher: string;
  proArchivedAt: string;
  archivedAt: string;
  prevState: string;
}

// "DD.MM.YYYY | HH:mm" -> Date (order.created shu shaklda saqlanadi).
function parseCreated(v: string): Date | null {
  const m = v.match(/(\d{2})\.(\d{2})\.(\d{4})(?:\s*\|\s*(\d{2}):(\d{2}))?/);
  if (!m) return null;
  return new Date(+m[3], +m[2] - 1, +m[1], m[4] ? +m[4] : 9, m[5] ? +m[5] : 0);
}

function fmt(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} | ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

// Arxivlangan o'quvchi arxivdan oldin qaysi holatda bo'lgan.
// Formula "Aktiv o'quvchilar" sahifasidagi bo'linish bilan bir xil ruhda.
function prevStateOf(id: number): string {
  if (id % 13 === 0) return "Muzlatilgan";
  if (id % 5 === 1) return "Yangi";
  return "Aktiv";
}

export function archiveExtras(o: Order): ArchiveExtras {
  const g = GROUPS[(o.id * 31) % GROUPS.length];
  const created = parseCreated(o.created);

  // "Pro arxiv" — avtomatik belgilanadigan oraliq holat, arxivdan oldin
  // keladi; ikkalasi ham yaratilgan sanadan keyin bo'lishi kerak.
  const proOffset = 30 + ((o.id * 7) % 120);
  const archOffset = proOffset + 5 + ((o.id * 3) % 25);

  return {
    group: g?.name ?? "—",
    teacher: g?.teacher ?? "—",
    proArchivedAt: created ? fmt(addDays(created, proOffset)) : "—",
    archivedAt: created ? fmt(addDays(created, archOffset)) : "—",
    prevState: prevStateOf(o.id),
  };
}

export const PREV_STATE_CLS: Record<string, string> = {
  Aktiv: "text-emerald-600",
  Yangi: "text-blue-600",
  Muzlatilgan: "text-amber-600",
};
