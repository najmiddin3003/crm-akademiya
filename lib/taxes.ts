import type { Db } from "mongodb";
import { SETTINGS_LIST_KINDS } from "@/lib/settingsLists";

// Soliq qoidalari — Sozlamalar → Moliya → Soliq ro'yxatidan.
//
// Qoida ikki xil bo'ladi:
//   • "percent" — foiz (asosi `base` bilan belgilanadi),
//   • "amount"  — oyiga qat'iy summa.
//
// Soliq HAMMAGA emas va hamma qoida ham emas: har bir xodimga aynan
// TANLANGAN qoidalar biriktiriladi (`hr_employees.taxIds`, Boshqaruv →
// Xodimlar dagi tugmacha bosilganda chiqadigan tanlov). Ro'yxatdagi "Faol"
// bo'lmagan yozuv esa umuman hisobga olinmaydi — tanlangan bo'lsa ham.

export interface TaxRule {
  /** `settings_taxes.id` — xodimga aynan shu id biriktiriladi. */
  id: number;
  name: string;
  type: "percent" | "amount";
  /** Foiz uchun — foiz raqami; aniq summa uchun — so'mdagi summa. */
  value: number;
}

/**
 * "1 500 000", "12%", "12,5" kabi matnlarni songa aylantiradi.
 *
 * Ro'yxatdagi pul va foiz qiymatlari MATN sifatida saqlanadi (referensdagidek
 * formatlangan holda kiritiladi), shuning uchun bo'shliq va foiz belgisi
 * tozalanadi.
 *
 * EKSPORT QILINGAN: aynan shu mantiq `EmployeeTaxModal` ichida ham nusxa
 * bo'lib turardi. Ikki nusxa vaqt o'tib bir-biridan uzoqlashsa, oyna bir
 * raqamni, oylik hisobi esa boshqasini ko'rsatardi.
 */
export function parseMoney(raw: unknown): number {
  // `\s` bo'shliqlarni qamrab oladi, uzilmas bo'shliq (U+00A0) ham shunda.
  let s = String(raw ?? "").replace(/\s/g, "").replace(/%/g, "");
  // VERGUL IKKI XIL MA'NODA kelishi mumkin: "12,5" — o'nlik kasr,
  // "1,800,000" — minglik ajratgich.
  //
  // NIMA NOTO'G'RI EDI: bu yerda `.replace(",", ".")` turardi va u FAQAT
  // BIRINCHI vergulni almashtirardi. Natijada "1,800,000" → "1.800000" →
  // 1.8 so'm bo'lib o'qilardi va soliq JIMGINA yo'qolardi (quyidagi
  // `value <= 0` sharti qoidani butunlay tashlab yuboradi). Qiymat qo'lda
  // kiritilgani uchun bu holat amalda mumkin.
  s = /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
  const n = Number(s.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Faol soliq qoidalarini o'qiydi.
 *
 * `active` maydoni yo'q eski yozuv FAOL deb qaraladi: ro'yxat qo'shish
 * oynasi tugmachani yoqilgan holda ochadi, ya'ni maydonsiz yozuv ham
 * yoqilgan bo'lishi kutiladi. Qiymati 0 yoki manfiy bo'lgan qoida esa
 * tashlab yuboriladi — u hech narsa ushlab qolmaydi, faqat chek va
 * jadvalda bo'sh qator bo'lib turardi.
 */
export async function loadTaxRules(db: Db): Promise<TaxRule[]> {
  const rows = await db.collection(SETTINGS_LIST_KINDS.taxes).find({}).sort({ id: 1 }).toArray();
  const out: TaxRule[] = [];
  for (const r of rows) {
    if (r?.active === false) continue;
    const type: TaxRule["type"] = /aniq|summa/i.test(String(r?.taxType ?? "")) ? "amount" : "percent";
    const value = parseMoney(type === "amount" ? r?.amount : r?.percent);
    if (value <= 0) continue;
    const id = Number(r?.id);
    if (!Number.isFinite(id)) continue;
    out.push({ id, name: String(r?.name ?? "Soliq").trim() || "Soliq", type, value });
  }
  return out;
}
