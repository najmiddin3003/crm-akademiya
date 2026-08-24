import type { Pupil, PupilStatus } from "@/lib/pupilsData";
import { pupilFullName, pupilStatusOf } from "@/lib/pupilsData";

// O'quvchilar → Ota-ona (sidebar: O'quvchilar > Ota-ona, href /parents).
//
// ILGARI NIMA NOTO'G'RI EDI: bu fayl ota-onalarni butunlay O'YLAB TOPARDI.
// seededRnd(index) generatori har bir o'quvchiga tasodifiy "Akmal ota" /
// "Nigora ona" ismini, tasodifiy telefon raqamini va tasodifiy "ilovani
// yuklab olgan" belgisini yopishtirardi. Sahifadagi birorta ism ham,
// birorta raqam ham haqiqiy emas edi — lekin ular haqiqiy ma'lumotdek
// ko'rinardi, ya'ni foydalanuvchini aldardi.
//
// ENDI: ota-ona maydonlari BAZADA allaqachon bor — pupils.fatherName /
// fatherPhone / fatherWork / motherName / motherPhone / motherWork
// (lib/pupilsData.ts), ularni o'quvchi profilidagi "Tahrirlash" tabi
// saqlaydi. Shuning uchun qatorlar faqat HAQIQATDA kiritilgan ota-onalardan
// quriladi: bitta qator = bitta ota YOKI bitta ona, o'z farzandiga bog'langan.
// Yozuvda na ism, na telefon bo'lsa — bunday ota-ona tizimda YO'Q va qator
// ham chiqmaydi (bo'sh qator ham, o'ylab topilgan qator ham emas).
//
// DIQQAT (rule b): "Ilovani yuklab olgan" ustunining manbasi loyihada
// UMUMAN yo'q — na pupils hujjatida, na boshqa kolleksiyada ilova/qurilma
// yozuvi yuritilmaydi. Shu sabab u ustun "—" bo'lib qoladi; 0 yoki "yo'q"
// yozish faktik da'vo bo'lardi.

export type ParentKind = "Ota" | "Ona";
export const PARENT_KINDS: ParentKind[] = ["Ota", "Ona"];

export interface ParentRow {
  /** Tanlash/eksport uchun barqaror kalit ("12-Ota") — bir o'quvchida 2 qator bo'lishi mumkin. */
  key: string;
  /** Farzandning pupils.id si — profil havolasi shunga boradi. */
  pupilId: number;
  pupilName: string;
  kind: ParentKind;
  /** pupils.fatherName / motherName — bo'sh bo'lishi mumkin (faqat telefon kiritilgan bo'lsa). */
  name: string;
  /** pupils.fatherPhone / motherPhone. */
  phone: string;
  /** pupils.fatherWork / motherWork — ish joyi. */
  work: string;
  /** Farzandning HAQIQIY balansi — /api/students/balances (transaction_entries). */
  balance: number;
  moderator: string;
  category: string;
  status: PupilStatus;
  /** Farzandning tug'ilgan sanasi ("YYYY-MM-DD" yoki ""). */
  birthDate: string;
}

/**
 * Moliya yozuvlarida o'quvchining id'si emas, ISMI saqlanadi, shuning uchun
 * balans ism bo'yicha topiladi (ActiveStudentsPage/CashboxKirimDrawer bilan
 * bir xil kalit).
 */
export function balanceKey(name: string): string {
  return name.trim().toLowerCase();
}

function clean(v: string | undefined): string {
  return (v ?? "").trim();
}

/**
 * Bazadagi o'quvchilardan ota-ona qatorlari.
 *
 * @param balances /api/students/balances javobi (kichik harfli ism → summa).
 *                 pupils.balance maydoni HECH QACHON yangilanmaydi, shuning
 *                 uchun u o'qilmaydi.
 */
export function buildParentRows(pupils: Pupil[], balances: Record<string, number>): ParentRow[] {
  const rows: ParentRow[] = [];
  for (const p of pupils) {
    const pupilName = pupilFullName(p);
    const shared = {
      pupilId: p.id,
      pupilName,
      // Balans — to'langan pul yig'indisi. Yozuv bo'lmasa 0: bu "ma'lumot
      // yo'q" emas, "hali hech qanday to'lov qilinmagan" degani.
      balance: balances[balanceKey(pupilName)] ?? 0,
      moderator: p.moderator ?? "",
      category: p.category ?? "",
      status: pupilStatusOf(p),
      birthDate: p.birthDate ?? "",
    };

    const father = { name: clean(p.fatherName), phone: clean(p.fatherPhone), work: clean(p.fatherWork) };
    const mother = { name: clean(p.motherName), phone: clean(p.motherPhone), work: clean(p.motherWork) };

    // Ism ham, telefon ham bo'sh bo'lsa — bu ota-ona haqida yozuv YO'Q.
    // Ish joyining o'zi qator ochish uchun yetarli emas.
    if (father.name || father.phone) rows.push({ key: `${p.id}-Ota`, kind: "Ota", ...father, ...shared });
    if (mother.name || mother.phone) rows.push({ key: `${p.id}-Ona`, kind: "Ona", ...mother, ...shared });
  }
  return rows;
}

// ---------- Filtrlar ----------
//
// Ilgari filtr modalida 10 ta tanlov bor edi, ammo faqat "Moderator"
// ishlardi — qolganlari (Kurs/Subkurs/O'qituvchi/Ranglar/Ilova holati/
// Balans oralig'i) bo'sh <select> lar edi va hech narsani filtrlamasdi.
// Endi bu yerdagi har bir maydon HAQIQIY pupils maydoniga tayanadi.

export interface ParentsFilters {
  /** "" | "Ota" | "Ona" */
  kind: string;
  moderator: string;
  category: string;
  /** PupilStatus qiymati ("Aktiv" | "Muzlatilgan" | "Arxiv"). */
  status: string;
  balanceFrom: string;
  balanceTo: string;
  /** Farzandning tug'ilgan sanasi oralig'i ("YYYY-MM-DD"). */
  birthFrom: string;
  birthTo: string;
}

export const EMPTY_PARENTS_FILTERS: ParentsFilters = {
  kind: "", moderator: "", category: "", status: "",
  balanceFrom: "", balanceTo: "", birthFrom: "", birthTo: "",
};

export function applyParentFilters(rows: ParentRow[], f: ParentsFilters): ParentRow[] {
  return rows.filter((r) => {
    if (f.kind && r.kind !== f.kind) return false;
    if (f.moderator && r.moderator !== f.moderator) return false;
    if (f.category && r.category !== f.category) return false;
    if (f.status && r.status !== f.status) return false;
    if (f.balanceFrom && r.balance < Number(f.balanceFrom)) return false;
    if (f.balanceTo && r.balance > Number(f.balanceTo)) return false;
    // Sanalar "YYYY-MM-DD" — leksikografik taqqoslash = xronologik taqqoslash.
    if (f.birthFrom && (!r.birthDate || r.birthDate < f.birthFrom)) return false;
    if (f.birthTo && (!r.birthDate || r.birthDate > f.birthTo)) return false;
    return true;
  });
}

/** Filtr ro'yxatlari faqat HAQIQATDA uchraydigan qiymatlardan quriladi. */
export function uniqueSorted(values: (string | undefined)[]): string[] {
  return [...new Set(values.filter((v): v is string => Boolean(v)))].sort();
}

/**
 * "250 000 UZS" — bo'sh joy ajratkich bilan (referensdagi _fmtBalanceUZS).
 * Ilgari 0 uchun BO'SH satr qaytarardi; bo'sh katak esa "ma'lumot yo'q"
 * degan taassurot beradi. Bu yerdagi 0 — haqiqiy yig'indi ("hali to'lov
 * qilinmagan"), shuning uchun u ham to'liq ko'rsatiladi.
 */
export function fmtBalanceUZS(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}${Math.abs(n).toLocaleString("ru-RU").replace(/,/g, " ")} UZS`;
}
