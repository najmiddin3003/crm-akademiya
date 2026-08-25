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
   */
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
  tolanmagan: number;
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
 * Qolgan qoldiq, ishorali: hisoblangan + o'tgan oydan − to'langanlar.
 * Manfiy chiqishi MUMKIN va bu xato emas: xodim hisoblangan oyligidan
 * ko'proq olgan (masalan, avans berilgan, keyin uni qoplagan o'quvchi
 * to'lovi bekor qilingan) — o'sha farq uning qarzdorligi.
 */
export function payrollDue(e: EmployeePayroll, p: PayrollPeriod): number {
  return payrollEarned(e, p) + e.carryOver - payrollPaid(e);
}

/**
 * Xodimning akademiyaga qarzdorligi (musbat son sifatida) — `payrollDue`
 * manfiy bo'lgandagi kattaligi. Qarzdorlik yo'q bo'lsa 0.
 */
export function payrollDebt(e: EmployeePayroll, p: PayrollPeriod): number {
  return Math.max(-payrollDue(e, p), 0);
}
