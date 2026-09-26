import type { CvApplication } from "@/lib/managementCv";

// Boshqaruv → Ishga qabul (CV) ro'yxatining FILTRLARI (26.09.2026).
//
// Arizalar ikki avlod (lib/managementCv.ts): yangi anketada fan, tajriba,
// ta'lim, bandlik va manba ro'yxatdan TANLANADI, eski anketada esa erkin
// matn ("28-maktabda 1 yil ishlaganman", "2 mln boladi"). Filtr ikkalasiga
// ham chidamli:
//   • fan — "o'z ichiga oladi" (harf kattaligi, tutuq belgisi va ortiqcha
//     bo'shliq farqsiz): "Ona tili" filtri "Ona tili va adabiyot" ni ham topadi;
//   • maosh — matndan so'mga (`parseSalary`); raqami yo'q ariza
//     ("Kelishilgan holda") oraliq berilganda chiqmaydi;
//   • yo'nalish, tajriba, ta'lim, bandlik, manba, holat — aniq qiymat.
//
// Ro'yxat klientda filtrlanadi — arizalar oz va hammasi bitta so'rovda keladi.

export interface CvFilters {
  position: string;
  subject: string;
  /** Tajriba — bir nechta daraja (CV_EXP_LEVELS); bo'sh — hammasi. */
  exp: string[];
  /** Kutilayotgan maosh oralig'i, so'm — faqat raqamlar (MoneyInput). */
  salaryFrom: string;
  salaryTo: string;
  edu: string;
  load: string;
  source: string;
  status: string;
}

export const NO_CV_FILTERS: CvFilters = {
  position: "",
  subject: "",
  exp: [],
  salaryFrom: "",
  salaryTo: "",
  edu: "",
  load: "",
  source: "",
  status: "",
};

/** Filtr nomi — `cvMatches(…, skip)` uchun (maosh oralig'i bitta filtr). */
export type CvFacet = "position" | "subject" | "exp" | "salary" | "edu" | "load" | "source" | "status";

/** Nechta filtr yoqilgan — "Tozalash" tugmasi shunga qarab chiqadi. */
export function activeCvFilters(f: CvFilters): number {
  return [f.position, f.subject, f.exp.length > 0, f.salaryFrom || f.salaryTo, f.edu, f.load, f.source, f.status].filter(Boolean).length;
}

/** Solishtirish kaliti: kichik harf, tutuq belgilari bir xil, bo'shliqlar yig'ilgan. */
export function textKey(s: string): string {
  return s.toLowerCase().replace(/[ʻʼ`‘’]/g, "'").replace(/\s+/g, " ").trim();
}

export function subjectMatches(subject: string | undefined, wanted: string): boolean {
  const w = textKey(wanted);
  return w !== "" && textKey(subject || "").includes(w);
}

/**
 * Kutilayotgan maosh matnidan so'm: "4 000 000" → 4000000, "2 mln boladi" →
 * 2000000, "3,5 mln" → 3500000, "800 ming" → 800000, "3 000 000 - 4 000 000"
 * → 3000000 (birinchi son). Raqami yo'q ("Kelishilgan holda") — null.
 */
export function parseSalary(raw: string | undefined): number | null {
  const s = String(raw || "").toLowerCase().replace(/ /g, " ");
  const unit = /(\d+(?:[.,]\d+)?)\s*(mln|million|млн|ming|тыс)/.exec(s);
  if (unit) {
    const n = parseFloat(unit[1].replace(",", "."));
    return Math.round(n * (/^(mln|million|млн)$/.test(unit[2]) ? 1_000_000 : 1_000));
  }
  const m = /\d{1,3}(?:[ .,]\d{3})+|\d+/.exec(s);
  return m ? Number(m[0].replace(/\D/g, "")) : null;
}

/**
 * Ariza filtrlardan va qidiruvdan o'tadimi. `q` — kichik harfli, qirqilgan.
 * `skip` — shu filtr hisobga olinmaydi: tanlov variantlari yonidagi son
 * "boshqa filtrlar bilan shu variantni tanlasam nechta chiqadi" bo'lishi uchun.
 */
export function cvMatches(c: CvApplication, f: CvFilters, q: string, skip?: CvFacet): boolean {
  if (skip !== "position" && f.position && c.position !== f.position) return false;
  if (skip !== "subject" && f.subject && !subjectMatches(c.subject, f.subject)) return false;
  if (skip !== "exp" && f.exp.length > 0 && !f.exp.includes((c.experience || "").trim())) return false;
  if (skip !== "edu" && f.edu && (c.edu || "") !== f.edu) return false;
  if (skip !== "load" && f.load && (c.load || "") !== f.load) return false;
  if (skip !== "source" && f.source && (c.source || "") !== f.source) return false;
  if (skip !== "status" && f.status && c.status !== f.status) return false;
  if (skip !== "salary" && (f.salaryFrom || f.salaryTo)) {
    const n = parseSalary(c.expectedSalary);
    if (n === null) return false;
    if (f.salaryFrom && n < Number(f.salaryFrom)) return false;
    if (f.salaryTo && n > Number(f.salaryTo)) return false;
  }
  if (!q) return true;
  return (
    c.name.toLowerCase().includes(q) ||
    (c.subject || "").toLowerCase().includes(q) ||
    (c.phone || "").includes(q)
  );
}
