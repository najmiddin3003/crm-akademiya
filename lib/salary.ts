import type { TaxRule } from "@/lib/taxes";

// Moliya → Oylik chiqarish. MongoDB `salary_runs` kolleksiyasi — har bir
// yozuv bitta "oylik chiqarish" partiyasi (tanlangan xodimlar bo'yicha
// umumlashtirilgan hisobot, audit-log — o'chirilmaydi/tahrirlanmaydi).
export interface SalaryRunItem {
  employeeId: number;
  /**
   * Xodimning shu chiqarish paytidagi ismi. Hisobot — audit-log, shuning
   * uchun ism o'sha ondagi holicha muzlatiladi (xodim keyin nomini
   * o'zgartirsa yoki o'chirilsa ham tarix o'qilishli qoladi). Eski
   * yozuvlarda yo'q.
   */
  name?: string;
  /**
   * Chiqarishdan keyingi QOLDIQ, ishorali:
   *   musbat — akademiya xodimga qarzdor (to'lanmagan qism),
   *   manfiy — XODIM akademiyaga qarzdor (masalan, avans olgan, ammo
   *            uni qoplagan tushum keyin bekor qilingan).
   * Ikkala tomon ham keyingi oyga o'tadi (lib/payrollSources.ts →
   * loadCarryOver).
   *
   * DIQQAT: bu TO'LOVDAN KEYINGI qoldiq. Chiqarish paytida pul kassadan
   * haqiqatan chiqarilgani uchun to'liq to'langan xodimda u 0 bo'ladi —
   * aks holda allaqachon to'langan summa keyingi oyga "qarz" bo'lib
   * o'tib ketardi.
   */
  amount: number;
  /** Shu chiqarishda xodimga kassadan chiqarilgan summa. */
  paid?: number;
  /**
   * CHEK uchun kesim — chiqarish PAYTIDAGI holat, muzlatilgan.
   *
   * Nima uchun saqlanadi: chek qayta hisoblanmasligi kerak. Xodimning
   * oyligi, foizi yoki soliq ro'yxati keyin o'zgarsa ham, berilgan chekdagi
   * raqamlar o'zgarmasligi shart — aks holda bir marta bosib berilgan
   * qog'oz bilan ekrandagi chek bir-biriga mos kelmay qolardi.
   * Eski yozuvlarda yo'q.
   */
  receipt?: SalaryReceipt;
}

/** Bitta xodimning bitta chiqarishdagi to'liq hisob-kitobi (chek uchun). */
export interface SalaryReceipt {
  turi?: string;
  salaryType?: "foiz" | "fixed";
  /** Oklad (qat'iy maosh) yoki foiz asosi. */
  fixedSalary?: number;
  percent?: number;
  /** Shu oyda o'qituvchi orqali tushgan pul — foizli hisob asosi. */
  collected?: number;
  /** Davr: nechanchi kun / oyda nechta kun (oklad pro-rata uchun). */
  day?: number;
  daysIn?: number;
  /** Asos (oklad pro-rata yoki tushumdan foiz). */
  base?: number;
  bonus?: number;
  jarima?: number;
  /** Hisoblangan: asos + bonus − jarima. */
  gross?: number;
  taxLines?: TaxLine[];
  tax?: number;
  paidAvans?: number;
  /** Shu oyda AVVAL chiqarilgan oylik (bu chiqarishgacha). */
  paidOylik?: number;
  carryOver?: number;
}

/** Chekdagi bitta soliq qatori. */
export interface TaxLine {
  name: string;
  /** "12%" yoki "qat'iy" — foydalanuvchiga ko'rsatiladigan izoh. */
  detail: string;
  amount: number;
}

export interface SalaryRun {
  id: number;
  employeeCount: number;
  oylik: number;
  davomat: number;
  davomatFoizi: number;
  bonus: number;
  avans: number;
  jarima: number;
  akladi: number;
  /** Shu chiqarishda ushlab qolingan soliq (barcha xodimlar bo'yicha). */
  soliq?: number;
  tolanmagan: number;
  /**
   * Shu chiqarishda kassadan HAQIQATAN chiqarilgan summa.
   *
   * Ilgari "Oylik chiqarish" faqat hisobot yozardi — pul hech qayerdan
   * chiqmasdi va shu sababli xodimning "To'langan oylik"i 0, chiqarishning
   * "To'lanmagan"i esa to'liq summa bo'lib qolaverardi. Endi chiqarish
   * kassadan chiqim yozuvlarini ham yaratadi va shu maydon o'sha summani
   * qayd etadi. Eski yozuvlarda yo'q — 0 deb o'qiladi.
   */
  tolangan?: number;
  /** Pul qaysi kassadan va qaysi to'lov turi bilan chiqqani (izlanish uchun). */
  cashboxId?: number;
  cashboxName?: string;
  /**
   * To'lov turining BARQAROR kaliti — bekor qilishda kassaning qaysi
   * `methodTotals` maydonini tiklash kerakligini shu aniqlaydi. `methodLabel`
   * esa faqat ko'rsatish uchun va Sozlamalardan o'zgartirilishi mumkin.
   */
  method?: string;
  methodLabel?: string;
  /**
   * Xodimlarning akademiyaga qarzdorligi (manfiy qoldiqlar yig'indisi,
   * musbat son sifatida). Eski yozuvlarda yo'q — 0 deb o'qiladi.
   */
  qarzdorlik?: number;
  createdAt: string; // "DD.MM.YYYY | HH:mm"
  /** "YYYY-MM" — qaysi oy uchun chiqarilgani. Eski yozuvlarda yo'q. */
  month?: string;
  /** Xodim kesimidagi qoldiqlar. Eski yozuvlarda yo'q. */
  items?: SalaryRunItem[];
}

// ---------- Oylik davri: shu oy boshidan bugungi kungacha (pro-rata) ----------
//
// Oklad shu oyda o'tgan kunlarga nisbatan bo'linadi (oklad × o'tgan kun /
// oy kunlari), foizli xodimda esa shu oyda haqiqatan tushgan pul asos
// bo'ladi. Shuning uchun sahifada davr yorlig'i ("1 — 19-avgust (19/31
// kun)") ko'rsatiladi: raqamlar aynan shu oraliq uchun.

export const UZ_MONTHS = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
];

export interface PayrollPeriod {
  year: number;
  /** 0-11 */
  month: number;
  /** Oy boshidan hisoblangan kunlar soni (bugungi sana). */
  day: number;
  /** Shu oydagi kunlar soni. */
  daysIn: number;
}

export function payrollPeriod(now: Date = new Date()): PayrollPeriod {
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysIn = new Date(year, month + 1, 0).getDate();
  return { year, month, day: Math.min(now.getDate(), daysIn), daysIn };
}

/** "1 — 19-avgust (19/31 kun)" */
export function payrollPeriodLabel(p: PayrollPeriod): string {
  return `1 — ${p.day}-${UZ_MONTHS[p.month]} (${p.day}/${p.daysIn} kun)`;
}

/** "2026-08" */
export function payrollMonthKey(p: PayrollPeriod): string {
  return `${p.year}-${String(p.month + 1).padStart(2, "0")}`;
}

/** Oldingi oyning kaliti — "o'tgan oydan qolgan"ni hisoblash uchun. */
export function prevMonthKey(p: PayrollPeriod): string {
  const y = p.month === 0 ? p.year - 1 : p.year;
  const m = p.month === 0 ? 12 : p.month;
  return `${y}-${String(m).padStart(2, "0")}`;
}

/** "Iyul" — o'tgan oy nomi (izohlar uchun). */
export function prevMonthName(p: PayrollPeriod): string {
  const n = UZ_MONTHS[(p.month + 11) % 12];
  return n.charAt(0).toUpperCase() + n.slice(1);
}

// Xodim uchun joriy hisoblangan oylik-komponentlar (Oylik chiqarish →
// xodim tanlash jadvalidagi bitta qator).
export interface EmployeePayroll {
  id: number;
  name: string;
  phone: string;
  /** "teacher" | "moderator" | "admin" — filtr uchun. */
  turi: string;
  /**
   * Xodimning ish haqi SOZLANGANMI (xodim kartasida filial bo'yicha oklad
   * kiritilganmi). false bo'lsa hisoblangan raqamlar ma'nosiz — interfeys
   * "Oylik sozlanmagan" ko'rsatishi kerak, soxta 0 emas.
   */
  configured: boolean;
  /** "foiz" — o'qituvchi tushumdan foiz oladi; "fixed" — oklad. */
  salaryType: "foiz" | "fixed";
  /** Oklad (xodim kartasidagi filiallar bo'yicha ish haqi yig'indisi). */
  fixedSalary: number;
  /** O'qituvchi foizi (%). */
  percent: number;
  /** Shu oyda shu xodim orqali tushgan pul (foizli hisob uchun asos). */
  collected: number;
  /** Kelgusi oylar uchun oldindan tushgan pul — o'z oyida hisoblanadi. */
  futureCollected: number;
  /** Shu oydagi bonus/jarima yig'indisi. */
  bonus: number;
  jarima: number;
  /** Shu oyda berilgan avans. */
  paidAvans: number;
  /** Shu oyda kassadan chiqarilgan oylik. */
  paidOylik: number;
  /**
   * O'tgan oydan o'tgan qoldiq, ishorali: musbat — to'lanmagan qism,
   * MANFIY — xodimning akademiyaga qarzdorligi (o'tgan oyda avans olgan,
   * lekin uni qoplagan tushum bekor qilingan). Manfiysi shu oyning
   * hisobidan ushlab qolinadi.
   */
  carryOver: number;
  carryNote: string;
  /**
   * Bu xodimga soliq solinadimi (Boshqaruv → Xodimlar dagi tugmacha,
   * `hr_employees.taxIds` bo'sh emasmi). HOSILA qiymat: quyidagi `taxRules`
   * bo'sh bo'lmasa rost. Soliq HECH KIMGA o'z-o'zidan qo'llanmaydi.
   */
  taxable: boolean;
  /**
   * SHU xodimga biriktirilgan soliq qoidalari — ro'yxatdagi hammasi emas.
   * Sozlamalarda o'chirilgan yoki nofaol qilingan qoida bu yerga tushmaydi.
   */
  taxRules: TaxRule[];
}

/** Shu oy uchun hisoblangan asos (oklad pro-rata yoki tushumdan foiz). */
export function payrollBase(e: EmployeePayroll, p: PayrollPeriod): number {
  return e.salaryType === "fixed"
    ? Math.round(e.fixedSalary * p.day / p.daysIn)
    : Math.round(e.collected * e.percent / 100);
}

/** Shu oyda hisoblangan oylik: asos + bonus - jarima. */
export function payrollEarned(e: EmployeePayroll, p: PayrollPeriod): number {
  return payrollBase(e, p) + e.bonus - e.jarima;
}

/** To'langanlar: avans + chiqarilgan oylik. */
export function payrollPaid(e: EmployeePayroll): number {
  return e.paidAvans + e.paidOylik;
}

/**
 * Xodimdan ushlab qolinadigan soliq qatorlari.
 *
 * • FOIZ — hisoblangan oylikdan (asos + bonus − jarima) olinadi, ya'ni
 *   oklad pro-rata bo'lgani uchun soliq ham o'z-o'zidan davrga mos keladi.
 * • ANIQ SUMMA — to'liq olinadi, oy o'rtasida ham bo'linmaydi: sozlamada
 *   "aniq harajat" deb yozilgan raqam aynan shu holicha ushlanadi.
 *
 * Kartasida soliq YOQILMAGAN xodimda bo'sh ro'yxat qaytadi.
 */
export function payrollTaxLines(e: EmployeePayroll, p: PayrollPeriod): TaxLine[] {
  if (!e.taxable) return [];
  const gross = payrollEarned(e, p);
  return e.taxRules.map((r) =>
    r.type === "percent"
      ? { name: r.name, detail: `${r.value}%`, amount: Math.round((gross * r.value) / 100) }
      : { name: r.name, detail: "qat'iy", amount: Math.round(r.value) },
  );
}

/**
 * Umumiy soliq. HISOBLANGAN OYLIKDAN OSHMAYDI: aks holda sof oylik manfiy
 * chiqib, u "xodim qarzdorligi" bo'lib keyingi oyga o'tib ketardi — soliq
 * esa xodimning qarzi emas. Chegara urgan holat interfeysda ko'rinadi
 * (soliq = hisoblangan, qolgan = 0).
 */
export function payrollTax(e: EmployeePayroll, p: PayrollPeriod): number {
  const total = payrollTaxLines(e, p).reduce((s, l) => s + l.amount, 0);
  return Math.min(total, Math.max(payrollEarned(e, p), 0));
}

/**
 * Qolgan qoldiq, ishorali: hisoblangan − soliq + o'tgan oydan − to'langanlar.
 * Manfiy chiqishi MUMKIN va bu xato emas: xodim hisoblangan oyligidan
 * ko'proq olgan (masalan, avans berilgan, keyin uni qoplagan o'quvchi
 * to'lovi bekor qilingan) — o'sha farq uning qarzdorligi.
 *
 * SOLIQ shu yerda ayriladi, ya'ni kassadan chiqadigan summa allaqachon
 * sof oylik bo'ladi (Moliya → Oylik chiqarish shu qiymatni to'laydi).
 */
export function payrollDue(e: EmployeePayroll, p: PayrollPeriod): number {
  return payrollEarned(e, p) - payrollTax(e, p) + e.carryOver - payrollPaid(e);
}

/**
 * Xodimning akademiyaga qarzdorligi (musbat son sifatida) — `payrollDue`
 * manfiy bo'lgandagi kattaligi. Qarzdorlik yo'q bo'lsa 0.
 */
export function payrollDebt(e: EmployeePayroll, p: PayrollPeriod): number {
  return Math.max(-payrollDue(e, p), 0);
}
