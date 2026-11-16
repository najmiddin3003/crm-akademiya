// O'QUVCHILAR BO'LIMI RO'YXATLARI (yangi versiya, 30-qism) — klient va server uchun umumiy turlar.
//
// Bitta javob (GET /api/students/lists, lib/studentLists.ts) oltita sahifani boqadi: Yangi, Aktiv,
// Arxiv o'quvchilar, Joriy oyda obunasi tugaydiganlar, Ota-ona, O'quvchilar manzillari. Har sahifa
// o'z qatorlarini shu ro'yxatdan TANLAYDI (pastdagi funksiyalar) — qoida bitta joyda.

import type { DebtMonths } from "@/lib/debtorsTypes";

/** Joriy oy to'lov holati (Aktiv o'quvchilar → «Oktabr» ustuni). */
export type MonthPayState =
  /** Joriy oy (oy oxirigacha) to'liq yopilgan. */
  | "paid"
  /** Oldingi oylardan qarz yo'q, joriy oy uchun to'lov kuni hali kelmagan. */
  | "due"
  /** Qarz bor: o'tgan oy(lar)dan yoki to'lov kuni o'tgan joriy oydan. */
  | "debt"
  /** Hisoblab bo'lmaydi: guruh yo'q, narx kiritilmagan va h.k. */
  | "none";

export interface ListGroup {
  id: number;
  name: string;
  course: string;
  level: string;
  teacher: string;
  /** A'zolik boshlangan kun ("YYYY-MM-DD"); noma'lum — null. */
  joinedAt: string | null;
  /** A'zolik yopilgan kun (arxiv/chiqarilgan); ochiq — null. */
  leftAt: string | null;
  /** Oylik narx (Oflayn kurslar); noma'lum — null. */
  monthlyPrice: number | null;
}

/** Ota-ona kabineti (o'quvchilar boti) holati. */
export type CabinetState = "in" | "invited" | "none";

export interface StudentListRow {
  id: number;
  name: string;
  phone: string;
  status: "Aktiv" | "Muzlatilgan" | "Arxiv";
  statusChangedAt: string;
  statusReason: string;
  source: string;
  createdAt: string;
  /** Ochiq a'zoliklar (hozir o'qiyotgan guruhlari). */
  groups: ListGroup[];
  /** Oxirgi yopilgan a'zolik (arxivdagilar uchun «Oxirgi guruh»). */
  lastGroup: ListGroup | null;
  /** Eng birinchi a'zolik boshlangan kun ("YYYY-MM-DD") — «Qo'shilgan». */
  firstJoinedAt: string | null;
  /** Lid sifatida birinchi darsga yozilgan (lid kartasi bor). */
  fromFirstLesson: boolean;

  // --- Pul (lib/debtors.ts qoidasi bilan) ---
  /** Bugungacha to'langan (qaytarimlar ayrilgan). */
  paid: number;
  /** Bugungacha hisoblangan − to'langan; musbat — qarz. */
  debt: number;
  /** Oy oxirigacha hisoblangan − to'langan; musbat — joriy oyni yopish uchun kerak. */
  debtMonthEnd: number;
  /** Qarz qaysi oylar uchun (bugungi holat). */
  unpaid: DebtMonths | null;
  /** Oylik narxlar yig'indisi (ochiq guruhlar bo'yicha); noma'lum — null. */
  monthlyTotal: number | null;
  monthState: MonthPayState;
  /** To'lov kuni joriy oyda ("YYYY-MM-DD"). */
  dueDate: string | null;
  /** Oxirgi to'lov ("YYYY-MM-DD"). */
  lastPaymentDate: string | null;

  // --- Ota-ona ---
  fatherName: string;
  fatherPhone: string;
  fatherWork: string;
  motherName: string;
  motherPhone: string;
  motherWork: string;
  cabinet: CabinetState;
  /** Kabinetga kirgan / taklif yuborilgan kun ("YYYY-MM-DD"). */
  cabinetAt: string | null;

  // --- Taklif (lidlardagi «Referal bergan o'quvchi») ---
  referred: number;
  referredPaid: number;
  /** Shu o'quvchini kim tavsiya qilgan (lid kartasidagi ism). */
  referredBy: string;

  // --- Eslatma (joriy oyda shu raqamlarga yuborilgan oxirgi SMS) ---
  lastSmsAt: string | null;
  lastSmsBy: string;

  // --- Manzil ---
  address: string;
  mahalla: string;
  landmark: string;
  /** "Doimiy" | "Ijara" | "". */
  housing: string;
}

export interface StudentListsPayload {
  ok: true;
  /** Hisob sanasi — bugun (Toshkent), "YYYY-MM-DD". */
  asOf: string;
  rows: StudentListRow[];
  /** O'quvchilar botining havolasi («https://t.me/…»); bot sozlanmagan — bo'sh. */
  botLink: string;
}

/** «YYYY-MM» — joriy oy. */
export function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

/** Ikki sana orasidagi kunlar (b − a). */
export function daysBetween(a: string, b: string): number {
  const t = (s: string) => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));
  return Math.round((t(b) - t(a)) / 86_400_000);
}

/* ---------------- Sahifa tanlovlari ---------------- */

/**
 * YANGI O'QUVCHI — rasm: «guruhga qo'shilgan, birinchi oy to'lovi hali to'liq emas».
 * Bazada «Yangi» holati yo'q (SAVOLLAR 36, 410): faol, guruhda o'qiyotgan, birinchi a'zoligi
 * so'nggi 2 oy ichida boshlangan va to'langani hali bir oylik narxga yetmagan o'quvchi.
 */
export function isNewStudent(r: StudentListRow, asOf: string): boolean {
  if (r.status !== "Aktiv" || r.groups.length === 0 || !r.firstJoinedAt) return false;
  if (daysBetween(r.firstJoinedAt, asOf) > 62) return false;
  const target = firstMonthTarget(r);
  return target === null ? r.paid <= 0 : r.paid < target;
}

/** Birinchi oy uchun to'lanishi kerak: ochiq guruhlar oylik narxlari yig'indisi. */
export function firstMonthTarget(r: StudentListRow): number | null {
  return r.monthlyTotal;
}

/** AKTIV O'QUVCHI — holati «Aktiv» va hozir guruhda o'qiyotgan, «Yangi» emas. */
export function isActiveStudent(r: StudentListRow, asOf: string): boolean {
  return r.status === "Aktiv" && r.groups.length > 0 && !isNewStudent(r, asOf);
}

/**
 * OBUNASI TUGAYOTGAN — joriy oy hali yopilmagan, oldingi oylardan qarz yo'q va to'lov kuni
 * bugundan oy oxirigacha (rasm: «to'langan davri 13–31-oktabrda tugaydi, keyingi to'lov hali
 * qilinmagan»).
 */
export function isExpiring(r: StudentListRow, asOf: string): boolean {
  if (r.status !== "Aktiv" || r.monthState !== "due" || !r.dueDate) return false;
  return r.dueDate >= asOf && monthOf(r.dueDate) === monthOf(asOf);
}

export interface ParentRow {
  /** Telefonning oxirgi 9 raqami — kalit. */
  key: string;
  name: string;
  phone: string;
  /** "Ota" | "Ona". */
  role: "Ota" | "Ona";
  work: string;
  children: StudentListRow[];
  /** Farzandlari bo'yicha qarz − haqdorlik (musbat — haqdor, manfiy — qarz). */
  balance: number;
  cabinet: CabinetState;
  cabinetAt: string | null;
}

const digits9 = (s: string) => String(s || "").replace(/\D/g, "").slice(-9);

/**
 * OTA-ONALAR — o'quvchi kartasidagi ota va ona maydonlaridan (ism yoki telefon kiritilgan bo'lsa).
 * Bir xil telefon — bitta odam (bir nechta farzand); telefoni yo'q — farzand bilan alohida qator.
 */
export function parentsOf(rows: StudentListRow[]): ParentRow[] {
  const byKey = new Map<string, ParentRow>();
  for (const r of rows) {
    if (r.status === "Arxiv") continue;
    const sides: { role: "Ota" | "Ona"; name: string; phone: string; work: string }[] = [
      { role: "Ota", name: r.fatherName, phone: r.fatherPhone, work: r.fatherWork },
      { role: "Ona", name: r.motherName, phone: r.motherPhone, work: r.motherWork },
    ];
    for (const s of sides) {
      if (!s.name.trim() && !digits9(s.phone)) continue;
      const key = digits9(s.phone) || `${s.role}:${r.id}`;
      const prev = byKey.get(key);
      if (prev) {
        if (!prev.children.some((c) => c.id === r.id)) prev.children.push(r);
        if (!prev.name && s.name) prev.name = s.name.trim();
        if (!prev.work && s.work) prev.work = s.work.trim();
      } else {
        byKey.set(key, {
          key,
          name: s.name.trim() || "—",
          phone: s.phone,
          role: s.role,
          work: s.work.trim(),
          children: [r],
          balance: 0,
          cabinet: "none",
          cabinetAt: null,
        });
      }
    }
  }
  const out = [...byKey.values()];
  for (const p of out) {
    p.balance = p.children.reduce((s, c) => s - c.debt, 0);
    // Kabinet — farzandlaridan birortasining ota-onasi botga kirgan bo'lsa «kirgan».
    const rank = { in: 2, invited: 1, none: 0 } as const;
    for (const c of p.children) {
      if (rank[c.cabinet] > rank[p.cabinet] || (c.cabinet === p.cabinet && (c.cabinetAt ?? "") > (p.cabinetAt ?? ""))) {
        p.cabinet = c.cabinet;
        p.cabinetAt = c.cabinetAt;
      }
    }
  }
  return out;
}
