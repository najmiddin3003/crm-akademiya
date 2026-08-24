// Xodim qo'shish modali YIG'ADIGAN, lekin `lib/hrEmployees.ts` dagi
// `HrEmployee` interfeysida hali e'lon qilinmagan maydonlar.
//
// NEGA shu yerda: `lib/hrEmployees.ts` bu vazifadagi egalik ro'yxatiga
// kirmaydi, shuning uchun uni tahrirlash o'rniga maydonlar shu qo'shimcha
// interfeysda turadi. `HrEmployee` ga ular ko'chirilgach, bu fayl olib
// tashlanadi (izoh: qaytarilgan hisobotdagi "notes" ga qarang).
//
// Ilgari bu maydonlarning HAMMASI shakl ichida yig'ilib, hech qayerga
// yuborilmasdi — foydalanuvchi to'ldirgan sana, izoh va toggle'lar
// jimgina yo'qolardi.
import type { HrEmployee } from "@/lib/hrEmployees";

/** Sozlamalardagi maxsus maydon TA'RIFI (qiymati emas). */
export interface EmployeeCustomFieldDef {
  id: number;
  name: string;
  /** constants/employees.js dagi CUSTOM_FIELD_TYPES dan biri. */
  type: string;
  required: boolean;
  /** So'rovnomada ko'rinishi — referensdagi ikkinchi toggle. */
  inSurvey: boolean;
  /** Faqat "Tanlov (select)" turi uchun: tanlanadigan variantlar. */
  options: string[];
}

export interface HrEmployeeExtra {
  /** `<input type="date">` formati: "YYYY-MM-DD". */
  birthDate?: string;
  /** Modaldagi "Izoh" maydoni. */
  comment?: string;
  /**
   * "Ish haqi chiqarish" toggle'i — ro'yxatdagi "Maosh hisoblanadi" ustuni.
   * SAQLANGAN TANLOV, xolos: lib/payrollSources.ts dagi buildPayrollRows()
   * `hr_employees` ni filtrsiz o'qiydi va bu maydonga qaramaydi, ya'ni Oylik
   * chiqarish hozircha hamma xodimni hisoblaydi. Ustun shu sababli "Ha/Yo'q"
   * emas, "Belgilangan/Belgilanmagan" deb ko'rsatiladi.
   */
  payroll?: boolean;
  /**
   * "Ikki bosqichli tasdiqlash" toggle'i. Hozircha uni O'QIYDIGAN kod yo'q —
   * app/api/auth/login/route.ts faqat telefon + parolni tekshiradi. Qiymat
   * rost saqlanadi, lekin xavfsizlik xulqiga ta'sir qilmaydi (modaldagi
   * izohga qarang).
   */
  twoFactor?: boolean;
  /** Maxsus maydon nomi → kiritilgan qiymat (hammasi satr ko'rinishida). */
  customFields?: Record<string, string>;
}

/** Bazadagi to'liq hujjat — asosiy maydonlar + yuqoridagi qo'shimchalar. */
export type HrEmployeeFull = HrEmployee & HrEmployeeExtra;

/**
 * `settings` kolleksiyasidagi kalitlar. Shakl:
 *   management.employee-custom-fields → { fields: EmployeeCustomFieldDef[] }
 *   management.employee-profile-tabs  → { hidden: string[] }
 * Sozlamalar bo'limidagi boshqa tablar bilan bir xil naqsh
 * (components/settings/FieldSettingsTab.tsx ga qarang).
 */
export const EMPLOYEE_CUSTOM_FIELDS_KEY = "management.employee-custom-fields";
export const EMPLOYEE_PROFILE_TABS_KEY = "management.employee-profile-tabs";

/** GET /api/settings javobidan maxsus maydon ta'riflarini xavfsiz o'qish. */
export function readCustomFieldDefs(values: unknown): EmployeeCustomFieldDef[] {
  const raw = (values as { fields?: unknown } | null)?.fields;
  if (!Array.isArray(raw)) return [];
  const out: EmployeeCustomFieldDef[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const name = String(r.name ?? "").trim();
    if (!name) continue;
    out.push({
      id: Number(r.id) || out.length + 1,
      name,
      type: String(r.type ?? ""),
      required: Boolean(r.required),
      inSurvey: Boolean(r.inSurvey),
      options: Array.isArray(r.options) ? r.options.map((o) => String(o)) : [],
    });
  }
  return out;
}
