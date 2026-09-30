import type { TaxRule } from "@/lib/taxes";
import { uzNow } from "@/lib/uzTime";

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
   * `paid` ning kanal bo'yicha kesimi: `paidPlastik + paidNaqd === paid`.
   * Eski yozuvlarda yo'q — ularda hammasi bitta kanaldan chiqqan.
   */
  paidPlastik?: number;
  paidNaqd?: number;
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

/**
 * USTOZ ALMASHUVI izohi (lib/teacherHandover.ts, 30.09.2026) — oy o'rtasida
 * o'quvchilar boshqa ustozga o'tganda tushum kunlarga qarab bo'linadi.
 * HISOBGA TA'SIR QILMAYDI: `collected` allaqachon bo'lingan, bu faqat nima
 * sababdan ekanini ko'rsatish uchun.
 */
export interface PayrollHandover {
  /** "out" — shu ustozdan boshqaga o'tgan tushum; "in" — boshqa ustozdan kelgani. */
  dir: "out" | "in";
  /** out: yangi ustoz(lar) ismi ("" — hech kimga o'tmagan); in: eski ustoz ismi. */
  other: string;
  /** Eski ustozning oxirgi dars kuni, "YYYY-MM-DD". */
  lastDay: string;
  /**
   * out: eski ustozda qolgan kunlar/darslar; in: yangi ustozga o'tgani.
   * `daysIn` — oy kunlari yoki oydagi jami darslar (`unit` ga qarab).
   */
  days: number;
  daysIn: number;
  /** "lessons" — dars kunlari bo'yicha; yo'q yoki "days" — kalendar kunlari. */
  unit?: "days" | "lessons";
  /** Ko'chgan TUSHUM (so'm, yaxlitlanmagan; qaytarim bo'lsa manfiy qismi bilan). */
  amount: number;
}

/** Bitta xodimning bitta chiqarishdagi to'liq hisob-kitobi (chek uchun). */
export interface SalaryReceipt {
  turi?: string;
  salaryType?: SalaryType;
  /** Oklad (qat'iy maosh) yoki foiz asosi. */
  fixedSalary?: number;
  percent?: number;
  /**
   * Ishga kirgan sana ("YYYY-MM-DD") va shu davrda oklad hisoblangan kunlar
   * — chekdagi "oklad × kun/oy" formulasi uchun (29.09.2026 dan). Eski
   * cheklarda yo'q: u yerda oklad `day` bo'yicha hisoblangan.
   */
  salaryStart?: string;
  /** Ishdan ketgan sana ("YYYY-MM-DD") — chiqarish paytidagi holat. */
  salaryEnd?: string;
  okladDays?: number;
  /** Asosning ikki qismi — "oklad + foiz" xodimda chekda alohida ko'rinadi. */
  okladPart?: number;
  foizPart?: number;
  /** Ustoz almashuvi izohlari — chiqarish paytidagi holat (30.09.2026 dan). */
  handovers?: PayrollHandover[];
  /**
   * Shu oyda o'qituvchi orqali tushgan pul — foizli hisob asosi (SOF:
   * o'quvchilarga qaytarilgani ayrilgan).
   */
  collected?: number;
  /**
   * Shu oyda o'quvchilariga qaytarilgan pul (musbat). Chekda "tushum −
   * qaytarim" izohi uchun; 18.09.2026 gacha bo'lgan cheklarda yo'q.
   */
  refunded?: number;
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
  /**
   * PLASTIK kesimi. Eski cheklarda yo'q.
   *
   * `plastikSalary` — chiqarish paytidagi NOMINAL summa (soliq asosi).
   * `paidPlastikBefore` — shu oyda undan oldin kartadan berilgani.
   * `plastikTarget` — kartaga MO'LJAL (payrollPlastikTarget) o'sha
   *   paytdagi qoida bo'yicha, muzlatilgan: chekdagi "qoldiq yetmadi"
   *   izohi shundan solishtiradi. 16.09.2026 gacha bu maydon yo'q edi —
   *   o'sha davr cheklarida mo'ljal qoidasi boshqacha (davrga bo'lingan)
   *   bo'lgani uchun chek oynasi eski qoidaga qaytadi.
   * `paidPlastik` / `paidNaqd` — shu chiqarishdagi ikki oyoq.
   */
  plastikSalary?: number;
  paidPlastikBefore?: number;
  plastikTarget?: number;
  paidPlastik?: number;
  paidNaqd?: number;
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
   * Chiqarish QAYSI kanallardan qancha pul yechganini — kalit kesimida.
   *
   * `method`/`methodLabel` MA'NOSINI SAQLAYDI (naqd oyog'i) — eski
   * hujjatlar va `SalaryReceiptModal` shunga tayanadi. `legs` esa to'liq
   * rasmni beradi va bekor qilishda aynan shu ishlatiladi: kalitsiz
   * yozuvda to'lov turini TAXMIN qilish naqd oyog'ini plastik chelagiga
   * qaytarib, kassa summalarini jimgina buzardi.
   */
  legs?: { key: string; label: string; total: number }[];
  /** Kanallar bo'yicha yig'indi (`legs` ning qisqartmasi, hisobot uchun). */
  plastikTolangan?: number;
  naqdTolangan?: number;
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
  /**
   * Chiqarish QAYSI FILIALDA bajarilgani.
   *
   * Eski hujjatlarda YO'Q va bu farq muhim: o'chirish qorovuli
   * `run.branchId !== scope.branchId` shaklida yozilsa, `undefined !== 1`
   * doim rost bo'lib, maydonsiz eski chiqarishni HECH KIM (admin ham)
   * o'chira olmasdi. Qorovul shu bois `undefined` ni ALOHIDA qaraydi.
   */
  branchId?: number;
  /** Xodim kesimidagi qoldiqlar. Eski yozuvlarda yo'q. */
  items?: SalaryRunItem[];
}

// ---------- Oylik davri: shu oy boshidan bugungi kungacha (pro-rata) ----------
//
// Oklad shu oyda o'tgan kunlarga nisbatan bo'linadi (oklad × o'tgan kun /
// oy kunlari), foizli xodimda esa shu oyda haqiqatan tushgan pul asos
// bo'ladi. Shuning uchun sahifada davr yorlig'i ("1 — 19-avgust (19/31
// kun)") ko'rsatiladi: raqamlar aynan shu oraliq uchun.
//
// Xodim oy o'rtasida ishga kirgan bo'lsa (`salaryStart`), oklad o'sha
// kundan sanaladi — `payrollOkladDays` (29.09.2026).

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

// SUKUT — TOSHKENT soati, `new Date()` emas. Vercel'da server UTC'da
// ishlaydi va 1-sentabr soat 02:00 (Toshkent) da `new Date()` hali
// 31-avgustni ko'rsatardi: kassa yozuvlari sentabr sanasi bilan tushar
// (todayIso() ham uzNow() ga tayanadi), oylik sahifasi esa avgustni
// hisoblardi. Toshkent brauzerida (UTC+5) `uzNow()` siljish bermaydi,
// ya'ni mijoz tomonidagi xulq o'zgarmaydi.
export function payrollPeriod(now: Date = uzNow()): PayrollPeriod {
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysIn = new Date(year, month + 1, 0).getDate();
  return { year, month, day: Math.min(now.getDate(), daysIn), daysIn };
}

/**
 * "2026-08" kalitidan davr — oylikni O'TGAN oy uchun hisoblash uchun.
 *
 * TUGAGAN oyda `day = daysIn`, ya'ni oy TO'LIQ hisoblanadi. Bu shart:
 * `payrollBase` okladni `fixedSalary × day / daysIn` bilan bo'ladi, ya'ni
 * bugungi kun raqami qolib ketsa 1-sentabrda ochilgan AVGUST oyligi 1/31
 * ga kesilib ketardi. Foizli xodimda `day` umuman ishlatilmaydi — bu qoida
 * faqat oklad tarmog'iga tegadi.
 *
 * JORIY oyda hozirgi xulq saqlanadi: oy boshidan bugungacha (pro-rata).
 * KELAJAK oyda `day = 0` — hali ishlanmagan oyga oklad hisoblanmaydi.
 * (Interfeys ham, server ham kelajak oyni tanlashga yo'l qo'ymaydi; bu
 * shunchaki oxirgi himoya.)
 *
 * Noto'g'ri kalit berilsa joriy davr qaytadi — chaqiruvchi hech qachon
 * ma'nosiz davr olmaydi.
 */
export function payrollPeriodOf(monthKey: string, now: Date = uzNow()): PayrollPeriod {
  const cur = payrollPeriod(now);
  const m = /^(\d{4})-(\d{2})$/.exec(String(monthKey ?? "").trim());
  if (!m) return cur;
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  if (month < 0 || month > 11) return cur;
  if (year === cur.year && month === cur.month) return cur;
  const daysIn = new Date(year, month + 1, 0).getDate();
  const past = year < cur.year || (year === cur.year && month < cur.month);
  return { year, month, day: past ? daysIn : 0, daysIn };
}

/** Kalit "YYYY-MM" shaklidami — so'rov parametrlarini tekshirish uchun. */
export function isMonthKey(v: unknown): v is string {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(v ?? "").trim());
}

/**
 * Davrning OXIRGI kuni, "YYYY-MM-DD".
 *
 * O'tgan oy uchun oylik chiqarilganda kassa yozuvining sanasi shu bo'ladi.
 * NIMA UCHUN bugungi sana EMAS: "to'langan oylik" aynan `date` maydonining
 * oyi bo'yicha yig'iladi (lib/payrollSources.ts → loadPaidByEmployee). Agar
 * avgust oyligi sentabr sanasi bilan yozilsa, avgust qayta ochilganda o'sha
 * summa yana "to'lanmagan" bo'lib ko'rinardi va IKKINCHI marta to'lash
 * mumkin bo'lardi.
 */
export function payrollMonthEndIso(p: PayrollPeriod): string {
  return `${p.year}-${String(p.month + 1).padStart(2, "0")}-${String(p.daysIn).padStart(2, "0")}`;
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

/**
 * Ish haqi turi:
 *   "fixed" — oklad (xodim kartasidagi filial bo'yicha ish haqi);
 *   "foiz"  — o'qituvchi o'quvchilari to'lagan puldan foiz oladi;
 *   "mixed" — OKLAD + FOIZ (29.09.2026): ikkalasi ham kiritilgan xodim,
 *             masalan 1 000 000 oklad + har bir o'quvchi to'lovidan 30%.
 *
 * "mixed" dan oldin okladi ham, foizi ham bor xodim JIMGINA "fixed"
 * hisoblanardi — foiz tashlab yuborilardi (bazada shunday bitta o'qituvchi
 * bor edi, 1 000 000 + 30%).
 */
export type SalaryType = "foiz" | "fixed" | "mixed";

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
  /** "foiz", "fixed" yoki "mixed" (oklad + foiz) — `SalaryType` izohiga qarang. */
  salaryType: SalaryType;
  /** Oklad (xodim kartasidagi filiallar bo'yicha ish haqi yig'indisi). */
  fixedSalary: number;
  /**
   * ISHGA KIRGAN (oylik yoziladigan) sana, "YYYY-MM-DD"; kiritilmagan
   * bo'lsa "" yoki yo'q. Oklad shu kundan hisoblanadi (`payrollOkladDays`).
   */
  salaryStart?: string;
  /**
   * ISHDAN KETGAN sana (oxirgi ish kuni), "YYYY-MM-DD"; yo'q — hali ishlayapti.
   * Oklad shu kungacha hisoblanadi (`payrollOkladDays`).
   */
  salaryEnd?: string;
  /** Xodim arxivda (ketgan) — faqat ishdan ketgan oyigacha ro'yxatda bo'ladi. */
  archived?: boolean;
  /**
   * Xodim CRM'ga qo'shilgan kun, "YYYY-MM-DD" ("" — o'qib bo'lmadi).
   * HISOBGA KIRMAYDI — faqat eslatma uchun: shu oyda qo'shilgan okladli
   * xodimda ishga kirgan sana kiritilmagan bo'lsa, Oylik sahifasi buni
   * aytadi (aks holda unga to'liq oy yozilayotgani ko'rinmasdi).
   */
  createdDate?: string;
  /** O'qituvchi foizi (%). */
  percent: number;
  /**
   * Shu oyda shu xodim orqali tushgan pul (foizli hisob uchun asos) —
   * o'quvchilariga QAYTARILGAN pul ayrilgan holda (sof). Ya'ni o'quvchi
   * to'lovini qaytarib olsa, ustozning foizli oyligi o'sha summaning foizi
   * qadar kamayadi (lib/payrollSources.ts → loadCollectedByTeacher).
   * Manfiy bo'lishi mumkin — u holda asos manfiy, qoldiq qarzdorlik
   * bo'lib keyingi oyga o'tadi (bekor qilingan to'lov bilan bir xil yo'l).
   */
  collected: number;
  /**
   * Shu oyda ustozning o'quvchilariga qaytarilgan pul (musbat) — faqat
   * KO'RSATISH uchun: `collected` allaqachon sof, formulalar bunga
   * tegmaydi. Yalpi tushum = `collected + refunded`.
   */
  refunded: number;
  /**
   * Ustoz almashuvi (oy o'rtasida o'quvchilar boshqa ustozga o'tgan) —
   * `collected` ALLAQACHON kunlarga qarab bo'lingan; bu faqat izoh.
   * Yo'q yoki bo'sh — almashuv yo'q.
   */
  handovers?: PayrollHandover[];
  /**
   * ESLATMA (faqat Oylik sahifasi, joriy va o'tgan oy): shu oy ustoz nomiga
   * to'lagan o'quvchilardan `count` tasi endi FAQAT boshqa ustozning SHU
   * FANDAGI guruhida (`teachers`), ustoz almashuvi esa kiritilmagan.
   * Hisobga ta'sir qilmaydi — lib/teacherHandoverStore.ts → detectMovedPupils.
   */
  movedHint?: { count: number; teachers: string[] };
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
  /**
   * Xodimga plastik karta orqali beriladigan oylik summasi
   * (`hr_employees.plastikSalary`). Biriktirilmagan xodimda 0.
   *
   * SOLIQ HISOBIGA UMUMAN TEGMAYDI. Soliq bugungidek hisoblangan
   * oylikdan ushlanadi. Bu summa to'lanadigan qoldiqdan BIRINCHI kartaga
   * ketadi, xodimga qo'lga faqat undan oshgani beriladi (quyida
   * `payrollPlastikLeg` / `payrollCashLeg`).
   */
  plastikSalary: number;
  /**
   * Shu oyda xodimga PLASTIK bilan chiqarilgan avans + oylik.
   * `paidAvans + paidOylik` ning QISM to'plami, ular bilan qo'shilmaydi.
   * Faqat karta oyog'ining qolgan maqsadini hisoblashda ishlatiladi.
   */
  paidPlastik: number;
  /**
   * Shu xodimga BOSHQA filial kassalaridan berilgan avans/oylik, kassa
   * filiali bo'yicha. `paidAvans`/`paidOylik` ning QISM to'plami — ular
   * bilan qo'shilmaydi, hisobga ta'sir qilmaydi, faqat ko'rsatish uchun.
   * Faqat Oylik sahifasining filial ko'rinishida to'ldiriladi
   * (lib/payrollSources.ts → attachBranchPayouts).
   */
  paidElsewhere?: PaidElsewhere[];
}

/** Xodimga boshqa filial kassasidan berilgan pul (bitta filial bo'yicha). */
export interface PaidElsewhere {
  /** Kassa biriktirilgan filial nomi; kassa hech qaysi filialga biriktirilmagan bo'lsa "". */
  branch: string;
  avans: number;
  oylik: number;
}

/**
 * Oylik sahifasidagi "Berilgan avans" va "To'langan oylik" kartochkalari —
 * pul QAYSI FILIAL KASSASIDAN chiqqani bo'yicha (foydalanuvchi, 23.09.2026:
 * "kim avans bergan bo'lsa o'sha moderator filialida ko'rinsin").
 *
 * Jadval qatorlari esa avvalgidek XODIM bo'yicha qoladi: xodimning qolgan
 * oyligidan qaysi kassadan olgani emas, HAMMA olgani ushlab qolinadi.
 * Ikkalasining farqi shu yerdagi `toOthers` va `fromOthers` da ochiq turadi.
 */
export interface BranchPayouts {
  /** Filialga bitta ham kassa biriktirilmagan — raqamlar ma'nosiz. */
  hasCashbox: boolean;
  /** Shu filial kassalaridan shu oy uchun berilgani — KIMGA bo'lsa ham. */
  avans: number;
  oylik: number;
  /** Shundan shu filialning oylik ro'yxatida YO'Q xodimlarga berilgani. */
  toOthers: {
    name: string;
    /** Xodimning oylik ro'yxati filiali; topilmasa "". */
    branch: string;
    archived: boolean;
    avans: number;
    oylik: number;
  }[];
  /** Shu filial ro'yxatidagi xodimlar BOSHQA filial kassalaridan olgani. */
  fromOthers: { avans: number; oylik: number };
}

/** Oklad qismi bormi — "fixed" va "mixed" (oklad + foiz). */
export function payrollHasOklad(e: Pick<EmployeePayroll, "salaryType">): boolean {
  return e.salaryType === "fixed" || e.salaryType === "mixed";
}

/** Foiz qismi bormi — "foiz" va "mixed" (oklad + foiz). */
export function payrollHasFoiz(e: Pick<EmployeePayroll, "salaryType">): boolean {
  return e.salaryType === "foiz" || e.salaryType === "mixed";
}

/** "YYYY-MM-DD" → { year, month (0-11), day }; o'qib bo'lmasa `null`. */
function parseIsoDay(v: unknown): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v ?? "").trim());
  if (!m) return null;
  const month = Number(m[2]) - 1;
  const day = Number(m[3]);
  if (month < 0 || month > 11 || day < 1) return null;
  return { year: Number(m[1]), month, day };
}

/**
 * Shu davrda OKLAD hisoblanadigan kunlar soni (29.09.2026).
 *
 *   ishga kirgan sana yo'q yoki davrdan OLDIN → `p.day` (eski xulq: oy
 *     boshidan; joriy oyda bugungacha, tugagan oyda to'liq);
 *   sana SHU OYDA → `p.day − kirgan kun + 1` (kirgan kuni ham sanaladi):
 *     23-sentabrda kirgan xodimga to'liq sentabr uchun 8/30 kun;
 *   sana KEYINGI OYLARDA → 0 (hali ishga kirmagan).
 *
 * NIMA NOTO'G'RI EDI: oklad doim `oy boshidan` bo'linardi, ya'ni oy
 * o'rtasida kirgan xodimga ham TO'LIQ oy yozilardi (foydalanuvchi:
 * "oy o'rtasidan kirsa ham to'liq oy uchun hisoblayapti").
 */
export function payrollOkladDays(e: Pick<EmployeePayroll, "salaryStart" | "salaryEnd">, p: PayrollPeriod): number {
  // Oyning qaysi kunidan (1-sana yoki ishga kirgan kun) qaysi kunigacha
  // (bugun / oy oxiri yoki ISHDAN KETGAN kun — shu kun ham) sanaladi.
  let from = 1;
  let to = p.day;
  const s = parseIsoDay(e.salaryStart);
  if (s) {
    if (s.year > p.year || (s.year === p.year && s.month > p.month)) return 0; // hali kirmagan
    if (s.year === p.year && s.month === p.month) from = s.day;
  }
  // ISHDAN KETGAN SANA (30.09.2026): oy o'rtasida ketgan xodimga to'liq oy
  // yozilmaydi; oldingi oyda ketgan bo'lsa — bu oyga oklad yo'q.
  const en = parseIsoDay(e.salaryEnd);
  if (en) {
    if (en.year < p.year || (en.year === p.year && en.month < p.month)) return 0;
    if (en.year === p.year && en.month === p.month) to = Math.min(to, en.day);
  }
  return Math.max(0, to - from + 1);
}

/**
 * Ishdan ketgan sana SHU (yoki oldingi) oyda — interfeys formulada
 * "ishdan ketgan sana: …" izohini faqat shunda ko'rsatadi.
 */
export function payrollEndsInPeriod(e: Pick<EmployeePayroll, "salaryEnd">, p: PayrollPeriod): boolean {
  const en = parseIsoDay(e.salaryEnd);
  return !!en && (en.year < p.year || (en.year === p.year && en.month <= p.month));
}

/**
 * Ishga kirgan sana SHU DAVRGA ta'sir qiladimi — shu oyda yoki keyin kirgan.
 * Interfeys formulada "(23-sentabrdan)" kabi izohni faqat shunda ko'rsatadi.
 */
export function payrollStartsInPeriod(e: Pick<EmployeePayroll, "salaryStart">, p: PayrollPeriod): boolean {
  const s = parseIsoDay(e.salaryStart);
  return !!s && (s.year > p.year || (s.year === p.year && s.month >= p.month));
}

/** Oklad qismi: oklad × ishlagan kunlar / oy kunlari. Foizli xodimda 0. */
export function payrollOkladPart(e: EmployeePayroll, p: PayrollPeriod): number {
  if (!payrollHasOklad(e) || p.daysIn <= 0) return 0;
  return Math.round(e.fixedSalary * payrollOkladDays(e, p) / p.daysIn);
}

/** Foiz qismi: shu oydagi sof tushum × foiz. Faqat okladli xodimda 0. */
export function payrollFoizPart(e: EmployeePayroll): number {
  return payrollHasFoiz(e) ? Math.round(e.collected * e.percent / 100) : 0;
}

/**
 * Shu oy uchun hisoblangan asos: oklad qismi (ishga kirgan kundan, pro-rata)
 * + foiz qismi (tushumdan). Oddiy okladli yoki foizli xodimda ikkinchi qism
 * 0 — natija avvalgi formula bilan bir xil.
 */
export function payrollBase(e: EmployeePayroll, p: PayrollPeriod): number {
  return payrollOkladPart(e, p) + payrollFoizPart(e);
}

/**
 * Ish haqi turining qisqa yozuvi — Sheets va Telegram xulosasi uchun
 * (o'zbekcha, `t()` siz): "oklad", "50%", "oklad + 30%".
 */
export function salaryTypeTag(e: Pick<EmployeePayroll, "salaryType" | "percent">): string {
  if (e.salaryType === "mixed") return `oklad + ${e.percent}%`;
  return e.salaryType === "foiz" ? `${e.percent}%` : "oklad";
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
  // `Math.max(..., 0)` YANGI: jarima asosdan katta bo'lsa hisoblangan oylik
  // manfiy bo'ladi va foizli qoida MANFIY soliq berardi. Manfiy soliq esa
  // `payrollDue` da xodimning qarzini KAMAYTIRARDI — quyidagi
  // `Math.min(total, max(gross,0))` qorovuli uni o'tkazib yuboradi.
  const gross = Math.max(payrollEarned(e, p), 0);
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
  // PASTDAN QISISH ham kerak: soliq hech qachon manfiy bo'lmaydi. Usiz
  // manfiy qator (manfiy gross + foizli qoida) `payrollDue` ga QO'SHILIB,
  // xodimning qarzini kamaytirib yuborardi.
  return Math.min(Math.max(total, 0), Math.max(payrollEarned(e, p), 0));
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

// ---------- To'lovning ikki oyog'i: PLASTIK va NAQD ----------
//
// KARTA BIRINCHI, NAQD — FAQAT UNDAN OSHGANI (foydalanuvchi qoidasi,
// 16.09.2026):
//
//     kartaga = min(plastik − shu oyda kartadan berilgani, qoldiq)
//     naqd    = qoldiq − kartaga            (qoldiq = hisoblangan − soliq
//                                            + o'tgan oydan − olinganlar)
//
// Ya'ni xodim ishlab topgani (soliqdan keyin) AVVAL kartaga ketadi; qo'lga
// beriladigani — karta TO'LIQ qoplangandan keyin qolgani. Misol: kartaga
// 1 000 000, xodim 800 000 ishlagan → kartaga 800 000, "Qolgan" 0;
// 1 200 000 ishlagan → kartaga 1 000 000, qo'lga 200 000.
//
// NIMA O'ZGARMAYDI: bu yerda HISOB YO'Q, faqat taqsimot — ikki oyoq
// yig'indisi doim `max(payrollDue, 0)`. Plastikni yoqish xodimga tegadigan
// JAMI summani o'zgartirmaydi, faqat qaysi kanaldan chiqishini aytadi.
//
// IKKI QOIDA, ikkalasi ham foydalanuvchi bilan kelishilgan:
//   • karta QOLDIQDAN OSHMAYDI — kam ishlagan xodimga karta "qarzga"
//     to'liq chiqarilmaydi, yetmagani KEYINGI OYGA HAM O'TMAYDI
//     (shu oyda qancha bo'lsa shu ketadi, tamom);
//   • karta qoplanmaguncha NAQD (avans ham, oylik ham) CHIQMAYDI —
//     kassa Chiqim oynasi va app/api/cashboxes/[id]/adjust chegarasi
//     aynan `payrollCashLeg` ga tenglashtirilgan.
//
// NEGA DAVRGA BO'LINMAYDI (10.09–16.09 oralig'ida `plastik × kun/oy` edi):
// bo'linsa oy o'rtasida kartaning bir qismi "hali kerak emas" deb naqdga
// o'tkazib yuborilardi va oyning qolgan qismida tushum sust bo'lsa karta
// oxirida to'lmay qolardi — bu "karta birinchi" qoidasiga zid. Karta
// oylik summa: oy boshidanoq to'liq mo'ljal, hisoblangan yetganicha
// to'ladi.

/**
 * Shu oyda kartaga YANA qancha yuborilishi kerakligi (mo'ljal).
 *
 * Oy davomida kartadan berilgan avans va oylik (`paidPlastik`) e'lon
 * qilingan summani to'ldirib boradi, ya'ni bir oyda ikkinchi marta
 * chiqarilganda karta oyog'i QAYTA to'liq chiqmaydi.
 */
export function payrollPlastikTarget(e: EmployeePayroll): number {
  return Math.max(e.plastikSalary - e.paidPlastik, 0);
}

/**
 * KARTA OYOG'I — shu chiqarishda plastik bilan beriladigan summa.
 *
 * `payrollDue` USTIDAN bo'linadi, `payrollEarned` ustidan EMAS: kassadan
 * chiqadigan pul — hisoblangan oylik emas, TO'LANADIGAN QOLDIQ (unda soliq,
 * avans va o'tgan oy qoldig'i ayrilgan). Qoldiq mo'ljaldan kichik bo'lsa
 * kartaga qoldiqning o'zi ketadi va naqd 0 bo'ladi.
 */
export function payrollPlastikLeg(e: EmployeePayroll, p: PayrollPeriod): number {
  return Math.min(payrollPlastikTarget(e), Math.max(payrollDue(e, p), 0));
}

/**
 * KARTADAN KEYINGI QOLDIQ, ishorali: to'lanadigan qoldiq − karta oyog'i.
 *
 * Musbat — xodimga qo'lga beriladigan naqd (sahifadagi "Qolgan" ustuni).
 * Manfiy FAQAT `payrollDue` manfiy bo'lganda (xodim ishlaganidan ko'p
 * olgan — qarzdor); karta yetmagani manfiy bermaydi, u shunchaki 0.
 * Plastigi yo'q xodimda bu aynan `payrollDue`.
 */
export function payrollCashDue(e: EmployeePayroll, p: PayrollPeriod): number {
  return payrollDue(e, p) - payrollPlastikLeg(e, p);
}

/**
 * NAQD OYOG'I — kartadan keyin qolgani, manfiy bo'lmaydi. Ayirma bo'lgani
 * uchun alohida yaxlitlanmaydi.
 *
 * Bu ayni paytda xodimga NAQD berish mumkin bo'lgan CHEGARA ham: kassa
 * Chiqim oynasidagi avans/oylik shu raqamdan oshmaydi.
 */
export function payrollCashLeg(e: EmployeePayroll, p: PayrollPeriod): number {
  return Math.max(payrollCashDue(e, p), 0);
}

/**
 * Kassadan CHIQADIGAN JAMI summa — ikki oyoq yig'indisi, ya'ni
 * `max(payrollDue, 0)`. Sahifa (chiqariladigan summa, "Qolgan
 * to'lanadigan" kartochkasi, sof foyda) va server (`tolangan`) aynan
 * shuni ishlatadi — ikkalasi bir xil raqamni ko'rsatishi shart.
 */
export function payrollPayout(e: EmployeePayroll, p: PayrollPeriod): number {
  return payrollPlastikLeg(e, p) + payrollCashLeg(e, p);
}
