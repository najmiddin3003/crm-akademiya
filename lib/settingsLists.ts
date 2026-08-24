// Sozlamalar bo'limidagi oddiy CRUD ro'yxatlari.
//
// Hammasi bir xil shaklda: kichik jadval + qo'shish/tahrirlash/o'chirish.
// Shuning uchun bitta generic route va bitta generic komponent bilan
// ishlanadi — `kind` ularni ajratadi.
export interface SettingsListItem {
  id: number;
  kind: string;
  // Ro'yxatga qarab ishlatiladigan maydonlar (hammasi majburiy emas).
  // `name` — har bir ro'yxatning asosiy ustuni (Sabab / Nomi / Lavozimi …).
  name: string;
  type?: string; // Sabablar — "Ketdi" | "Bekor qilindi" | "Davomat"
  active?: boolean; // To'lov turlari, SMS qurilmalar — Faol / Nofaol
  phone?: string; // Hamkorlar, 3-shaxs
  share?: string; // Hamkorlar — ulashish havolasi
  system?: boolean; // tizimli yozuv — o'chirib bo'lmaydi
  // To'lov turlari uchun: kassaning `methodTotals` maydonidagi barqaror
  // kalit (nom o'zgarsa ham o'zgarmaydi). lib/paymentMethods.ts ga qarang.
  key?: string;
  // Bayram kunlari — "YYYY-MM-DD"
  startDate?: string;
  endDate?: string;

  // Pul va foiz qiymatlari MATN sifatida saqlanadi: referensdagidek
  // "1 500 000" ko'rinishida formatlangan holda kiritiladi va shu holicha
  // ko'rsatiladi — bu ro'yxatlarda ular ustida hisob-kitob qilinmaydi.
  balance?: string; // 3-shaxs
  percent?: string; // Oylik foizlari
  // DIQQAT: "Bog'langan xodim soni" bu yerda YO'Q va bo'lmasligi ham kerak.
  // Ilgari u `staffCount` maydoni sifatida yozuvda saqlanardi, lekin uni
  // hech kim yangilamasdi — jadvalda seed'dan kelgan qotib qolgan son
  // turardi. Endi u har safar xodim kartochkalaridan hisoblanadi:
  // components/settings/monthlyPercentStaff.ts ga qarang.
  minPercent?: string; // Baholash darajalari
  maxPercent?: string; // Baholash darajalari
  color?: string; // Baholash darajalari, lid ranglari — "#rrggbb"
  emoji?: string; // Lid bosqichi belgisi
  company?: string; // SMS qurilmalar
  imei?: string; // SMS qurilmalar
  moderator?: string; // SMS qurilmalar
  online?: boolean; // SMS qurilmalar — Online / Offline
  // To'lov turi (Sozlamalar → Moliya → To'lov turlari) — referensdagi
  // qo'shish oynasidagi uchta belgi. Ular to'lov turi qaysi moliyaviy
  // amallarda tanlash uchun chiqishini boshqaradi.
  showInIncomeExpense?: boolean; // "Daromad xarajatlarini ko'rsatish"
  showInTransfer?: boolean; // "Transferda ko'rsatish"
  showInInvestment?: boolean; // "Sarmoya va dividentda ko'rsatish"
  halfRate?: string; // Grading tizimi — yarim stavka
  fullRate?: string; // Grading tizimi — bir stavka
}

export const LEAVE_REASON_TYPES = ["Ketdi", "Bekor qilindi", "Davomat"];

// Yozuvda uchrashi mumkin bo'lgan barcha maydonlar va ularning turi.
// POST/PATCH shu jadval bo'yicha kiruvchi ma'lumotni tozalaydi — yangi
// ro'yxat qo'shilganda route fayllariga tegish shart emas, faqat shu yerga
// (va yuqoridagi interfeysga) maydon qo'shiladi.
//
// `id`, `kind`, `system` va `key` bu yerda yo'q — ularni server o'zi
// belgilaydi, mijoz o'zgartira olmaydi.
export const LIST_FIELD_TYPES = {
  name: "string",
  type: "string",
  active: "boolean",
  phone: "string",
  share: "string",
  startDate: "string",
  endDate: "string",
  balance: "string",
  percent: "string",
  minPercent: "string",
  maxPercent: "string",
  color: "string",
  emoji: "string",
  company: "string",
  imei: "string",
  moderator: "string",
  online: "boolean",
  showInIncomeExpense: "boolean",
  showInTransfer: "boolean",
  showInInvestment: "boolean",
  halfRate: "string",
  fullRate: "string",
} as const;

export type ListFieldKey = keyof typeof LIST_FIELD_TYPES;

// Mijoz yuborgan tanani LIST_FIELD_TYPES bo'yicha tozalaydi: faqat tanish
// maydonlar, faqat to'g'ri turda o'tadi. POST va PATCH ikkalasi ham shundan
// foydalanadi, shuning uchun route emas, shu yerda turadi.
export function pickListFields(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [field, type] of Object.entries(LIST_FIELD_TYPES)) {
    if (!(field in body)) continue;
    const v = body[field];
    // Faqat "string" va "boolean" qoldi: yagona son maydon `staffCount` edi,
    // u endi umuman saqlanmaydi (hisoblanadi), shu bois son tarmog'i ham
    // olib tashlandi — hech qachon bajarilmaydigan kod turmasin.
    if (type === "boolean") {
      if (typeof v === "boolean") out[field] = v;
    } else if (typeof v === "string") {
      out[field] = v.trim();
    }
  }
  return out;
}

export const SETTINGS_LIST_KINDS = {
  reasons: "settings_reasons",
  "payment-methods": "settings_payment_methods",
  partners: "settings_partners",
  holidays: "settings_holidays",
  "third-persons": "settings_third_persons",
  "monthly-percents": "settings_monthly_percents",
  "assessment-levels": "settings_assessment_levels",
  activities: "settings_activities",
  "degrees-manager": "settings_degrees_manager",
  "degrees-teacher": "settings_degrees_teacher",
  hashtags: "settings_hashtags",
  "student-categories": "settings_student_categories",
  "sms-devices": "settings_sms_devices",
  "lead-colors": "settings_lead_colors",
} as const;

export type SettingsListKind = keyof typeof SETTINGS_LIST_KINDS;
