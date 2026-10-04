import type { Db, Filter } from "mongodb";
import { SETTINGS_LIST_KINDS } from "@/lib/settingsLists";
import {
  fixedSalaryOf,
  isSalaryConfigured,
  plastikSalaryOf,
  sanitizeSalaryEndDate,
  sanitizeSalaryStartDate,
  type HrEmployee,
} from "@/lib/hrEmployees";
import { PLASTIK_METHOD_KEY } from "@/lib/paymentMethods";
import {
  CLOSING_SALARY_RUN,
  payrollEarned,
  payrollFoizPart,
  payrollHasFoiz,
  payrollMonthKey,
  payrollPaid,
  payrollPeriod,
  payrollPeriodOf,
  payrollTax,
  prevMonthKey,
  prevMonthName,
  type BranchPayouts,
  type EmployeePayroll,
  type PaidElsewhere,
  type PayrollHandover,
  type PayrollPeriod,
  type SalaryType,
} from "@/lib/salary";
import { loadTaxRules } from "@/lib/taxes";
import { buildHandoverIndex, handoverFor, handoverRatio, loadHandovers } from "@/lib/teacherHandover";

// Oylik hisobiga kiradigan HAQIQIY manbalar. Ilgari bu yig'ish uch joyda
// (employees-payroll, salary-runs, Xodimlar ro'yxati) takrorlanardi va har
// biri xodim id'sidan hisoblanadigan demo generatorlarni ishlatardi —
// ya'ni ekranlar bir odam haqida turlicha raqam ko'rsatardi.
//
// Bu yerda faqat bazadagi ma'lumot ishlatiladi. Manbasi bo'lmagan had
// (davomat, akladi, tushum) o'ylab topilmaydi — 0 bo'lib qoladi va
// interfeys uni "sozlanmagan" deb ko'rsatadi.

/** Bir xodimga oid to'lovlarni ismi bo'yicha topish uchun kalit. */
function nameKey(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}

/**
 * Yozuv QAYSI OYGA tegishli ekanini aniqlaydigan Mongo sharti.
 *
 * Birlamchi manba — `periodMonth` ("YYYY-MM", Kirim/Oylik chiqarish
 * oynalarida tanlanadi). Maydon YO'Q yoki bo'sh bo'lgan yozuvlarda (bu
 * maydon qo'shilishidan oldingilar va import qilinganlar — bazadagi
 * yozuvlarning aksariyati) `date` ning oyi ishlatiladi, ya'ni eski hisob
 * buzilmaydi.
 *
 * KIRIM va CHIQIM uchun BIR XIL qoida bo'lishi shart: sentabrda kelgan
 * avgust to'lovi avgustga yozilib, o'sha avgust oyligi sentabrda berilsa
 * ham avgustga yozilmasa — avgust abadiy "to'lanmagan" bo'lib qolardi va
 * ikkinchi marta to'lash mumkin bo'lardi.
 */
export function monthMatch(month: string) {
  return [
    { periodMonth: month },
    { periodMonth: { $exists: false }, date: { $regex: `^${month}-` } },
    { periodMonth: "", date: { $regex: `^${month}-` } },
  ];
}

/**
 * "DD.MM.YYYY HH:mm" -> "YYYY-MM". O'qib bo'lmasa `null`.
 *
 * Bonus va jarima yozuvlarida sana shu ko'rinishda saqlanadi
 * (lib/bonuses.ts, lib/penalties.ts — `createdAt`).
 */
function monthOfCreatedAt(raw: unknown): string | null {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})/.exec(String(raw ?? "").trim());
  return m ? `${m[3]}-${m[2]}` : null;
}

/**
 * Xodim shu davr oylik ro'yxatidami. Faol — doim; ARXIVDAGI — faqat ishdan
 * ketgan sanasi kiritilgan va u shu oy yoki keyin bo'lsa (oxirgi oyligini
 * chiqarish uchun). Sanasiz arxivdagi — hech qachon (avvalgi xulq).
 */
export function isInPayrollPeriod(
  emp: Pick<HrEmployee, "archReason" | "salaryEndDate">,
  p: PayrollPeriod,
): boolean {
  if (["", null, undefined].includes(emp.archReason as string | null | undefined)) return true;
  const end = sanitizeSalaryEndDate(emp.salaryEndDate);
  return !!end && end.slice(0, 7) >= payrollMonthKey(p);
}

/**
 * Xodim hujjatidagi `created` ("DD.MM.YYYY | HH:mm") → "YYYY-MM-DD".
 * O'qib bo'lmasa "". Faqat eslatma uchun (EmployeePayroll.createdDate).
 */
function createdIso(raw: unknown): string {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})/.exec(String(raw ?? "").trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}

export interface PaidByEmployee {
  avans: number;
  oylik: number;
  /**
   * Shu oyda xodimga PLASTIK bilan chiqarilgan summa (avans + oylik).
   *
   * `avans` va `oylik` ning QISM to'plami — ular bilan qo'shilmaydi va
   * `payrollPaid` ga kirmaydi. Shu sabab ikki marta sanash tuzilmaviy
   * jihatdan imkonsiz: yuqoridagi ikkita chelak har doim to'liq summani
   * beradi, bu esa faqat "qanchasi kartadan ketdi" degan kesim.
   */
  plastik: number;
}

interface PayoutEntry {
  studentName?: unknown;
  txName?: unknown;
  amount?: unknown;
  paymentMethodKey?: unknown;
  cashboxId?: unknown;
}

/**
 * Shu oyda xodimlarga kassadan chiqarilgan avans/oylik YOZUVLARI.
 *
 * `loadPaidByEmployee` (jadval qatorlari) va `attachBranchPayouts`
 * (kartochkalar) IKKALASI shu yerdan o'qiydi — ya'ni qatordagi summa bilan
 * kartochkadagi yig'indi bitta yozuvlar to'plamidan chiqadi va oy qoidasi
 * ikki joyda ikki xil bo'lib qolmaydi.
 */
function loadPayoutEntries(db: Db, month: string): Promise<PayoutEntry[]> {
  return db
    .collection("transaction_entries")
    .find({
      txType: "payOut",
      // Kirim tomonidagi bilan AYNAN bir xil qoida — `monthMatch` izohiga qarang.
      $or: monthMatch(month),
      status: { $ne: "cancelled" },
      txName: { $regex: "avans|oylik", $options: "i" },
    })
    // Pastdagi tsikllar faqat shu beshtasini o'qiydi. 109 KB -> ~15 KB.
    .project<PayoutEntry>({ studentName: 1, txName: 1, amount: 1, paymentMethodKey: 1, cashboxId: 1, _id: 0 })
    .toArray();
}

/** Yozuv oylikmi yoki avansmi — `loadPaidByEmployee` bilan bir xil qoida. */
function payoutKind(r: PayoutEntry): "avans" | "oylik" {
  return /oylik/i.test(String(r.txName ?? "")) ? "oylik" : "avans";
}

/**
 * Shu oyda xodimlarga kassadan chiqarilgan avans va oylik.
 * Manba: `transaction_entries` — chiqim yozuvida xodim ismi `studentName`
 * da turadi (app/api/cashboxes/[id]/adjust/route.ts), kategoriya `txName` da.
 * Bekor qilinganlar hisobga olinmaydi.
 */
export async function loadPaidByEmployee(db: Db, month: string): Promise<Map<string, PaidByEmployee>> {
  const rows = await loadPayoutEntries(db, month);

  const map = new Map<string, PaidByEmployee>();
  for (const r of rows) {
    const k = nameKey(r.studentName);
    if (!k) continue; // egasi ko'rsatilmagan yozuv hech kimga tegishli emas
    const cur = map.get(k) ?? { avans: 0, oylik: 0, plastik: 0 };
    const amount = Math.abs(Number(r.amount) || 0);
    if (payoutKind(r) === "oylik") cur.oylik += amount;
    else cur.avans += amount;
    // KANAL — nom bo'yicha emas, BARQAROR kalit bo'yicha: ko'rinadigan nom
    // ("Plastik") Sozlamalardan o'zgartirilishi mumkin.
    //
    // Kaliti YO'Q yozuv NAQD deb sanaladi. Bu ataylab va o'lchangan:
    // bazadagi 19 ta chiqim yozuvining birortasida ham `paymentMethodKey`
    // yo'q va hammasi haqiqatan naqd edi. Teskarisi qilinsa, migratsiyadan
    // keyingi birinchi chiqarish kartaga umuman pul yubormay qo'yardi.
    if (String(r.paymentMethodKey ?? "") === PLASTIK_METHOD_KEY) cur.plastik += amount;
    map.set(k, cur);
  }
  return map;
}

export interface CollectedByTeacher {
  /**
   * Shu oyda ustoz orqali tushgan pul MINUS uning o'quvchilariga
   * qaytarib berilgani — foizli oylik AYNAN shundan hisoblanadi.
   * Manfiy bo'lishi mumkin (oy boshida tushum yo'q, lekin o'tgan oy
   * to'lovi qaytarildi) — bu xato emas: foizli asos manfiy chiqadi va
   * `payrollDue` xodim qarzdorligi bo'lib keyingi oyga o'tadi, to'lovi
   * bekor qilingan holat bilan bir xil yo'l (lib/salary.ts → carryOver).
   */
  collected: number;
  /** Shu oyda ustozning o'quvchilariga QAYTARILGAN pul (musbat, ma'lumot uchun). */
  refunded: number;
  /** Ustoz almashuvi izohlari (lib/teacherHandover.ts) — faqat ko'rsatish uchun. */
  handovers?: PayrollHandover[];
}

/**
 * Shu oyda har bir o'qituvchi orqali tushgan pul — foizli oylik uchun asos.
 * Manba: `transaction_entries` kirim yozuvlaridagi `teacherName`, ya'ni
 * to'lagan o'quvchining ustozi (app/api/cashboxes/[id]/adjust/route.ts).
 * Bekor qilinganlar hisobga olinmaydi.
 *
 * O'QUVCHIGA QAYTARILGAN PUL AYRILADI (foydalanuvchi, 18.09.2026): o'quvchi
 * 200 to'lab 100 ni qaytarib olsa, ustozning tushumi 100 ga kamayadi va
 * foizli oyligi qaytarilgan summaning foizi qadar (50% da — 50) kamayadi;
 * qolgan 50 markaz hisobidan ketadi (kassa chiqimi). Qaytarim yozuvi —
 * `payOut` + `studentRefund: true` + o'sha ustozning `teacherName` i
 * (lib/studentRefund.ts); oy qoidasi kirim bilan bir xil (`monthMatch`).
 */
export async function loadCollectedByTeacher(db: Db, month: string): Promise<Map<string, CollectedByTeacher>> {
  // USTOZ ALMASHUVI (30.09.2026) — oy o'rtasida o'quvchilar boshqa ustozga
  // o'tgan bo'lsa, ESKI ustoz nomidagi to'lovlar kalendar kunlariga qarab
  // bo'linadi (lib/teacherHandover.ts). Almashuv bo'lmagan oyda indeks bo'sh
  // va hisob avvalgidek.
  const handoversP = loadHandovers(db, month);
  const rows = await db
    .collection("transaction_entries")
    .find({
      // Ikkita `$or` bitta filtrda turolmaydi — `$and` orqali.
      $and: [
        { $or: [{ txType: "payIn" }, { txType: "payOut", studentRefund: true }] },
        // QAYSI OYGA tegishli ekani `periodMonth` da (Kirim oynasida
        // tanlanadi): pul sentabrda kelib, avgust darslari uchun bo'lishi
        // mumkin va o'qituvchining foizi AVGUSTGA hisoblanishi kerak.
        //
        // Maydon yo'q yozuvlarda (bu qo'shilishdan oldingilar va import
        // qilinganlar — bazadagi yozuvlarning aksariyati) avvalgidek `date`
        // ning oyi ishlatiladi, ya'ni eski hisob buzilmaydi.
        { $or: monthMatch(month) },
      ],
      status: { $ne: "cancelled" },
      teacherName: { $nin: ["", null] },
    })
    // Pastdagi tsikl faqat shularni o'qiydi. 666 KB -> 73 KB. `pupilId` va
    // `studentName` — ustoz almashuvida qaysi o'quvchi ekanini topish uchun.
    .project({ teacherName: 1, amount: 1, discountSom: 1, txType: 1, pupilId: 1, studentName: 1, _id: 0 })
    .toArray();
  const handovers = await handoversP;
  const index = buildHandoverIndex(handovers);

  const map = new Map<string, CollectedByTeacher>();
  const bucket = (k: string): CollectedByTeacher => {
    let cur = map.get(k);
    if (!cur) {
      cur = { collected: 0, refunded: 0 };
      map.set(k, cur);
    }
    return cur;
  };
  // Izohlar: bitta almashuv → eski ustozga bitta "out", har yangi ustozga bitta "in".
  const notes = new Map<string, { owner: string; note: PayrollHandover; names: Set<string> }>();
  const note = (key: string, owner: string, init: () => PayrollHandover) => {
    let n = notes.get(key);
    if (!n) {
      n = { owner, note: init(), names: new Set() };
      notes.set(key, n);
    }
    return n;
  };

  for (const r of rows) {
    const k = nameKey(r.teacherName);
    if (!k) continue;
    const amount = Math.abs(Number(r.amount) || 0);
    const isPay = r.txType === "payIn";
    // USTOZ FOIZI TO'LIQ NARXDAN (gamifikatsiya, TZ 4.16.4): o'quvchi tanga
    // evaziga chegirma olgan bo'lsa, kechilgan qism ham ustozning tushumiga
    // qo'shiladi — farqni markaz ko'taradi. Qaytarim — manfiy.
    const signed = isPay ? amount + Math.abs(Number(r.discountSom) || 0) : -amount;

    const match = handoverFor(index, month, r);
    const ratio = match ? handoverRatio(match.handover) : null;
    const keep = ratio ? ratio.old : 1;

    const own = bucket(k);
    own.collected += signed * keep;
    if (!isPay) own.refunded += amount * keep;
    if (!match || !ratio || keep >= 1) continue;

    // Oxirgi dars kunidan keyingi qism — yangi ustozga (bo'lmasa hech kimga).
    const moved = signed * (1 - keep);
    const h = match.handover;
    const toName = String(match.pupil.toTeacher ?? "").trim();
    const fk = nameKey(h.fromTeacher);
    const out = note(`${h.month}|${fk}|out`, k, () => ({
      dir: "out", other: "", lastDay: h.lastDay, days: ratio.oldDays, daysIn: ratio.daysIn, amount: 0, unit: ratio.unit,
    }));
    out.note.amount += moved;
    if (toName) out.names.add(toName);
    if (!toName) continue;
    const to = nameKey(toName);
    const tgt = bucket(to);
    tgt.collected += moved;
    if (!isPay) tgt.refunded += amount * (1 - keep);
    const inn = note(`${h.month}|${fk}|in|${to}`, to, () => ({
      dir: "in", other: h.fromTeacher, lastDay: h.lastDay, days: ratio.newDays, daysIn: ratio.daysIn, amount: 0, unit: ratio.unit,
    }));
    inn.note.amount += moved;
  }

  for (const { owner, note: n, names } of notes.values()) {
    if (n.dir === "out") n.other = [...names].join(", ");
    const cur = bucket(owner);
    (cur.handovers ??= []).push(n);
  }
  return map;
}

/**
 * O'qituvchi foizi. Xodim kartasida `percent` maydonida DARAJA NOMI saqlanadi
 * ("Yashil", "Sariq", …), raqam esa Sozlamalar → Moliya → Oylik foizlari
 * ro'yxatida turadi. Ilgari kod nomdan raqam ajratib olmoqchi bo'lardi va
 * "Yashil" uchun NaN chiqib, xodim id'sidan hisoblangan tasodifiy foizga
 * o'tib ketardi — ya'ni to'g'ri sozlangan o'qituvchi ham soxta foizda
 * hisoblanardi. Endi daraja nomi ro'yxatdan qidiriladi.
 */
export async function loadPercentByTier(db: Db): Promise<Map<string, number>> {
  const rows = await db.collection(SETTINGS_LIST_KINDS["monthly-percents"]).find({}).toArray();
  const map = new Map<string, number>();
  for (const r of rows) {
    const n = Number(String(r.percent ?? "").replace(/[^\d.]/g, ""));
    if (Number.isFinite(n)) map.set(nameKey(r.name), n);
  }
  return map;
}

/** Xodim kartasidagi `percent` qiymatini foizga aylantiradi. */
export function resolvePercent(raw: unknown, byTier: Map<string, number>): number | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const tier = byTier.get(nameKey(s));
  if (tier !== undefined) return tier;
  // Ro'yxatda yo'q, lekin sof son bo'lsa ("55") — o'shani olamiz.
  const n = Number(s.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && s.replace(/[^\d.]/g, "") !== "" ? n : null;
}

/**
 * Oyni FAQAT YOPADIGAN, pul chiqarmagan hujjat — `scripts/close-august-payroll.mjs`
 * yozgan 2026-08 "nol-yopish": kassasi yo'q, hamma `items[].amount` 0.
 * Haqiqiy chiqarish (app/api/salary-runs → POST) doim kassa bilan yoziladi.
 */
export function isPureCloseRun(run: { cashboxId?: unknown }): boolean {
  const c = run?.cashboxId;
  return c === undefined || c === null || c === "";
}

/**
 * Bitta o'tgan oyning keyingi oyga qo'shadigan SOF ULUSHI, ishorali.
 *
 *   oddiy oy       — hisoblangan − soliq − olingan;
 *   nol-yopish oyi — FAQAT foiz ulushi − olingan. O'sha oyning okladi,
 *                    soliqi va bonus/jarimasi eski tizimda hal qilingan
 *                    (close-august-payroll.mjs sarlavhasi), o'quvchilar esa
 *                    o'sha oy uchun keyin ham to'layveradi — ustoz ulushi
 *                    yo'qolmasligi kerak (foydalanuvchi, 02.10.2026).
 *
 * Ish haqi sozlanmagan xodimda 0 — uning "hisoblangan"i ma'nosiz.
 */
export function carryContribution(e: EmployeePayroll, p: PayrollPeriod, pureClose: boolean): number {
  if (!e.configured) return 0;
  if (pureClose) return payrollHasFoiz(e) ? payrollFoizPart(e) - payrollPaid(e) : 0;
  return payrollEarned(e, p) - payrollTax(e, p) - payrollPaid(e);
}

/**
 * OXIRGI NOL-YOPISH OYI ("YYYY-MM") yoki `null` (04.10.2026). Filtr
 * `loadCarryOver` dagi bilan bir xil — qoldiq zanjiri aynan shu oyda
 * to'xtaydi, shuning uchun shu oy va undan oldingilarga avans/oylik
 * yozilmaydi (lib/cashboxAdjust.ts; Chiqim oynasi uni
 * employees-payroll?branch=all javobidagi `closedThrough` dan oladi).
 */
export async function loadLastPureCloseMonth(db: Db): Promise<string | null> {
  const runs = await db
    .collection("salary_runs")
    .find<{ month?: string; cashboxId?: unknown }>(
      { month: { $type: "string" }, ...CLOSING_SALARY_RUN },
      { projection: { _id: 0, month: 1, cashboxId: 1 } },
    )
    .toArray();
  let last: string | null = null;
  for (const r of runs) {
    const m = String(r.month ?? "").trim();
    if (isPureCloseRun(r) && /^\d{4}-(0[1-9]|1[0-2])$/.test(m) && (last === null || m > last)) last = m;
  }
  return last;
}

/** Qoldiq zanjiri orqaga yuradigan oylar soni — himoya chegarasi. */
const CARRY_MAX_MONTHS = 24;

/**
 * O'tgan oylardan o'tadigan qoldiq, ISHORALI:
 *   musbat — akademiya xodimga qarzdor (to'lanmagan oylik),
 *   manfiy — XODIM akademiyaga qarzdor (masalan, avans olgan, keyin uni
 *            qoplagan o'quvchi to'lovi bekor qilingan) — shu oyning
 *            hisobidan ushlab qolinadi.
 *
 * QOIDA (02.10.2026 dan): o'tgan oylarning JONLI sof qoldiqlari yig'indisi —
 * har oy uchun `carryContribution`, zanjir o'tgan oydan orqaga yuradi:
 *   • moliyaviy yozuvi UMUMAN yo'q oyda to'xtaydi. Okladli xodimning
 *     "hisoblangan"i har oy o'z-o'zidan paydo bo'ladi, "to'langan"i esa
 *     faqat kassadan keladi — yozuvsiz oyni sanash YOZUV YO'QLIGINI qarz
 *     qilib ko'rsatardi (tizimdan oldingi davr);
 *   • NOL-YOPISH oyini (`isPureCloseRun`) qo'shib, undan keyin to'xtaydi —
 *     undan oldingi hisob yopiq;
 *   • CARRY_MAX_MONTHS — himoya.
 *
 * NIMA NOTO'G'RI EDI: oy uchun oylik chiqarilgan bo'lsa (`salary_runs`),
 * qoldiq o'sha chiqarishda MUZLATILGAN `items[].amount` dan olinardi:
 *   – chiqarishdan KEYIN o'sha oy uchun kelgan to'lov (Kirim → «Qaysi oy
 *     uchun: Sentabr», 1–2 oktabrda) ustoz oyligiga qo'shilardi-yu, keyingi
 *     oyga HECH QACHON o'tmasdi — faqat o'sha oy sahifasida turardi;
 *   – chiqarishga KIRMAGAN xodimning qoldig'i ham butunlay tushib qolardi:
 *     bitta filialning chiqarishi oyni HAMMA uchun "yopardi" (4-filialda
 *     sentabr oyligi umuman chiqarilmagan edi);
 *   – avgust nol-yopishidan keyin «Avgust» tanlab kiritilgan to'lovlarning
 *     ustoz ulushi hech qayerga o'tmasdi.
 * O'lchandi (prod, 02.10.2026): avgustda 8 ustozda 2 586 500, sentabrda
 * 3 517 667 so'm shunday "osilib" qolgan edi (Muhammadjon Ahmadjanov:
 * 690 000 + 600 000).
 *
 * JONLI = muzlatilgan + keyingi o'zgarishlar: chiqarishdan keyin hech narsa
 * o'zgarmagan bo'lsa natija muzlatilgan qoldiq bilan aynan bir xil
 * (chiqarish `payrollDue` ni to'laydi). IKKI MARTA TO'LASH YO'Q: chiqarilgan
 * pul o'sha oyning "olingan"ida turadi (yozuvning `periodMonth` i — o'sha oy).
 *
 * NARXI: zanjirdagi har oy uchun bitta `buildPayrollRows` (carryOver: false,
 * `refs` umumiy), PARALLEL. Hozir 1–2 oy, har oy bittaga o'sadi; sekinlashsa
 * — oylik yig'indilarni bitta agregatsiyada (oy bo'yicha guruhlab) hisoblash.
 */
export async function loadCarryOver(db: Db, p: PayrollPeriod, refs?: PayrollRefs): Promise<Map<number, number>> {
  // Nol-yopish oylari — bitta so'rov. «Faqat karta» hujjatlari oyni yopmaydi
  // (CLOSING_SALARY_RUN), ularda kassa ham bor — bu yerga baribir tushmaydi.
  const runs = await db
    .collection("salary_runs")
    .find<{ month?: string; cashboxId?: unknown }>(
      { month: { $type: "string" }, ...CLOSING_SALARY_RUN },
      { projection: { _id: 0, month: 1, cashboxId: 1 } },
    )
    .toArray();
  const pure = new Set(runs.filter((r) => isPureCloseRun(r)).map((r) => String(r.month)));

  const chain: { month: string; pureClose: boolean }[] = [];
  let month = prevMonthKey(p);
  for (let i = 0; i < CARRY_MAX_MONTHS; i++) {
    const pureClose = pure.has(month);
    if (!pureClose) {
      const any = await db.collection("transaction_entries").countDocuments(
        { $or: monthMatch(month), status: { $ne: "cancelled" } },
        { limit: 1 },
      );
      if (any === 0) break;
    }
    chain.push({ month, pureClose });
    if (pureClose) break;
    month = prevMonthKey(payrollPeriodOf(month));
  }
  if (chain.length === 0) return new Map();

  // `carryOver: false` — REKURSIYA CHEGARASI: zanjirning o'zi har oyni bir
  // marta sanaydi. `refs` — oyga bog'liq bo'lmagan ma'lumot (xodimlar,
  // bonus/jarima, foiz darajalari, soliqlar) qayta o'qilmaydi.
  const parts = await Promise.all(
    chain.map(async (c) => {
      const period = payrollPeriodOf(c.month);
      const rows = await buildPayrollRows(db, period, { carryOver: false, refs });
      return { period, pureClose: c.pureClose, rows };
    }),
  );

  const carry = new Map<number, number>();
  for (const { period, pureClose, rows } of parts) {
    for (const e of rows) {
      const v = carryContribution(e, period, pureClose);
      if (v !== 0) carry.set(e.id, (carry.get(e.id) ?? 0) + v);
    }
  }
  for (const [id, v] of carry) if (v === 0) carry.delete(id);
  return carry;
}

/**
 * Barcha xodimlar uchun oylik qatorlarini HAQIQIY ma'lumotdan yig'adi.
 * Yagona manba — buni employees-payroll, salary-runs va Xodimlar ro'yxati
 * birgalikda ishlatadi, shunda uchala ekran bir xil raqam ko'rsatadi.
 *
 * DAVR PARAMETR: ilgari oy shu yerda `payrollPeriod()` bilan QOTIB
 * turardi, ya'ni har qanday ekran faqat server soatidagi joriy oyni
 * ko'rardi. Oqibati: kassir sanani o'tgan oyga qo'yib kirim kiritsa,
 * yozuv bazaga to'g'ri tushardi (`date: "2026-08-20"`), lekin uni
 * o'qiydigan filtr doim `^2026-09-` bo'lgani uchun o'sha pul hech
 * qaysi o'qituvchining oyligiga qo'shilmasdi — va o'tgan oyni qayta
 * hisoblaydigan kirish nuqtasi ham yo'q edi. Endi davrni chaqiruvchi
 * beradi (`payrollPeriodOf("2026-08")`), sukut esa joriy oy — eski
 * chaqiruvlar o'zgarishsiz ishlayveradi.
 */
/**
 * Oylik hisobining OYGA BOG'LIQ BO'LMAGAN qismi.
 *
 * Alohida ajratilgan sabab: o'tgan oyning qoldig'i hisoblanayotganda
 * `buildPayrollRows` ikkinchi marta chaqiriladi va bu beshta so'rovni
 * takrorlashning ma'nosi yo'q — xodimlar ro'yxati ham, soliq qoidalari ham
 * qaysi oy ko'rilayotganiga bog'liq emas.
 */
export interface PayrollRefs {
  employees: HrEmployee[];
  /**
   * Arxivdagi xodimlar OY BO'YICHA FILTRLANMASIN — profil daftari (arxivdagi
   * xodim profili ham ochiladi, lib/salaryLedger.ts). Sukut: faqat faollar va
   * ishdan ketgan oyigacha arxivdagilar (`isInPayrollPeriod`).
   */
  keepArchived?: boolean;
  bonusRows: { recipientName?: string; amount?: number; createdAt?: unknown }[];
  penaltyRows: { recipientName?: string; amount?: number; createdAt?: unknown }[];
  percentByTier: Map<string, number>;
  taxRules: Awaited<ReturnType<typeof loadTaxRules>>;
}

export async function loadPayrollRefs(
  db: Db,
  opts: {
    /**
     * Oylik QAYSI FILIALDAN chiqarilayotgani. Berilmasa — butun kompaniya
     * (sinxronizatsiya va skriptlar shu ko'rinishda ishlaydi).
     *
     * ⚠ `branchIds` EMAS, `payrollBranchId`. Farqi hayot-mamot:
     *     { branchIds: 1 }       → [1,2] xodim IKKALA ro'yxatda,
     *                              to'liq summa bilan — ikki marta to'lash;
     *     { payrollBranchId: 1 } → [1,2] xodim FAQAT 1-filial ro'yxatida.
     * Ikki marta to'lash arifmetika bilan emas, TO'PLAM BO'LINISHI bilan
     * yopiladi: har bir xodim har oyda aniq bitta ro'yxatda turadi.
     */
    payrollBranchId?: number;
  } = {},
): Promise<PayrollRefs> {
  // Faollar + ISHDAN KETGAN SANASI kiritilgan arxivdagilar (30.09.2026): ular
  // ketgan oyigacha ro'yxatda qoladi — oxirgi oyligini chiqarib bo'lsin. Qaysi
  // oyda ko'rinishi `buildPayrollRows` → `isInPayrollPeriod` da.
  const empFilter: Filter<HrEmployee> = {
    $or: [
      { archReason: { $in: ["", null] } },
      { salaryEndDate: { $regex: "^\\d{4}-\\d{2}-\\d{2}$" } },
    ],
  } as Filter<HrEmployee>;
  if (opts.payrollBranchId !== undefined) {
    (empFilter as Record<string, unknown>).payrollBranchId = opts.payrollBranchId;
  }
  const [employees, bonusRows, penaltyRows, percentByTier, taxRules] = await Promise.all([
    // ARXIVLANGAN (ishdan ketgan) XODIM OYLIK HISOBIGA KIRMAYDI.
    //
    // NIMA NOTO'G'RI EDI: bu yerda `find({})` turardi, ya'ni arxivdagi
    // xodimga ham har oy to'liq oklad hisoblanardi va u "to'lanmagan"
    // bo'lib turaverardi. O'lchandi: 12 ta arxivlangan xodimdan uchtasida
    // oklad sozlangan (7 000 000, 3 500 000 va 1 000 000 so'm) — ya'ni
    // ishdan ketganlarga oyiga 11.5 mln so'm "qarz" yozilib borardi.
    //
    // `archReason` — arxivlash sababi, u arxivlashda MAJBURIY so'raladi
    // (lib/moderatorsData.ts dagi `isActiveModerator` bilan bir xil qoida:
    // sabab bo'sh bo'lsa xodim faol). Maydon yo'q eski hujjatlar ham faol
    // hisoblanadi.
    db.collection<HrEmployee>("hr_employees")
      .find(empFilter)
      .sort({ id: 1 })
      .toArray(),
    db.collection("bonuses").find({ type: "employee", status: { $ne: "cancelled" } }).toArray(),
    db.collection("penalties").find({ type: "employee", status: { $ne: "cancelled" } }).toArray(),
    loadPercentByTier(db),
    loadTaxRules(db),
  ]);
  return {
    employees,
    bonusRows: bonusRows as PayrollRefs["bonusRows"],
    penaltyRows: penaltyRows as PayrollRefs["penaltyRows"],
    percentByTier,
    taxRules,
  };
}

export async function buildPayrollRows(
  db: Db,
  p: PayrollPeriod = payrollPeriod(),
  opts: { carryOver?: boolean; refs?: PayrollRefs; payrollBranchId?: number } = {},
): Promise<EmployeePayroll[]> {
  // `carryOver: false` — o'tgan oyning ochiq qoldig'ini hisoblayotganda
  // beriladi (loadCarryOver ichida). Usiz ikkalasi bir-birini cheksiz
  // chaqirar edi.
  const withCarry = opts.carryOver !== false;
  const month = payrollMonthKey(p);
  const refs = opts.refs ?? (await loadPayrollRefs(db, { payrollBranchId: opts.payrollBranchId }));
  const { bonusRows, penaltyRows, percentByTier, taxRules } = refs;
  // Arxivdagi xodim faqat ISHDAN KETGAN oyigacha (profil daftari bundan mustasno).
  const employees = refs.keepArchived ? refs.employees : refs.employees.filter((e) => isInPayrollPeriod(e, p));
  const [paidBy, carryBy, collectedBy] = await Promise.all([
    loadPaidByEmployee(db, month),
    withCarry ? loadCarryOver(db, p, refs) : Promise.resolve(new Map<number, number>()),
    loadCollectedByTeacher(db, month),
  ]);

  const prevMonth = prevMonthName(p);
  const currentMonth = payrollMonthKey(payrollPeriod());
  // Bonus/jarima SHU OYNIKI bo'lishi kerak.
  //
  // NIMA NOTO'G'RI EDI: ular oy bo'yicha umuman filtrlanmasdi — butun tarix
  // har bir oyga qo'shilardi. Bitta oy ko'riladigan paytda bu sezilmasdi,
  // lekin endi o'tgan oy ham hisoblanadi va bitta bonus IKKI oyga (o'tgan
  // oyning qoldig'iga ham, shu oyning hisobiga ham) tushib, ikki marta
  // to'lanishi mumkin edi. (Bugun ikkala kolleksiya ham bo'sh — ya'ni
  // ko'rinadigan raqam o'zgarmaydi, bu kelajakdagi xatoni yopadi.)
  //
  // Sanasi o'qilmaydigan yozuv JORIY oyga qoladi: uni tashlab yuborish
  // pulni jimgina yo'qotardi.
  const inThisMonth = (r: { createdAt?: unknown }) => {
    const m = monthOfCreatedAt(r.createdAt);
    return m === null ? month === currentMonth : m === month;
  };
  const bonusesOfMonth = (bonusRows as { recipientName?: string; amount?: number; createdAt?: unknown }[]).filter(inThisMonth);
  const penaltiesOfMonth = (penaltyRows as { recipientName?: string; amount?: number; createdAt?: unknown }[]).filter(inThisMonth);
  // Soliq qoidalari id bo'yicha — har bir xodim o'ziga biriktirilganini oladi.
  const taxById = new Map(taxRules.map((r) => [r.id, r]));
  const sumFor = (rows: { recipientName?: string; amount?: number }[], k: string) =>
    rows.filter((r) => nameKey(r.recipientName) === k).reduce((s, r) => s + (Number(r.amount) || 0), 0);

  return employees.map((emp) => {
    const k = nameKey(emp.name);
    const paid = paidBy.get(k) ?? { avans: 0, oylik: 0, plastik: 0 };
    const fixedSalary = fixedSalaryOf(emp);
    const hasOklad = isSalaryConfigured(emp);
    const percent = resolvePercent(emp.percent, percentByTier);
    const carryOver = carryBy.get(emp.id) ?? 0;
    const collected = collectedBy.get(k) ?? { collected: 0, refunded: 0 };
    const empTaxRules = (Array.isArray(emp.taxIds) ? emp.taxIds : [])
      .map((id) => taxById.get(Number(id)))
      .filter((r): r is NonNullable<typeof r> => Boolean(r));

    // Ikki xil ish haqi bo'lishi mumkin va ikkalasi ham SOZLAMA hisoblanadi:
    //   • oklad — xodim kartasidagi filial bo'yicha ish haqi,
    //   • foiz  — o'qituvchiga biriktirilgan daraja (Oylik foizlari).
    // Ikkalasi ham yo'q bo'lsa xodim sozlanmagan.
    //
    // IKKALASI HAM BOR — "OKLAD + FOIZ" (29.09.2026, foydalanuvchi: "1 mln
    // oklad + har bir o'quvchi to'lovidan 30%"). Ilgari bu holat jimgina
    // "fixed" bo'lardi va foiz tashlab yuborilardi. O'lchandi: 58 faol
    // xodimdan faqat bittasida ikkalasi ham kiritilgan — aynan shunday
    // ishlaydigan o'qituvchi, ya'ni boshqa hech kimning hisobi o'zgarmaydi.
    const salaryType: SalaryType = hasOklad && percent !== null ? "mixed" : hasOklad ? "fixed" : "foiz";
    const configured = hasOklad || percent !== null;

    return {
      id: emp.id,
      name: emp.name,
      phone: emp.phone,
      turi: emp.turi ?? "teacher",
      configured,
      salaryType,
      fixedSalary,
      // Oklad shu kundan hisoblanadi (lib/salary.ts → payrollOkladDays).
      salaryStart: sanitizeSalaryStartDate(emp.salaryStartDate) ?? "",
      // Oklad shu kungacha (ishdan ketgan kun) — payrollOkladDays.
      salaryEnd: sanitizeSalaryEndDate(emp.salaryEndDate) ?? "",
      // Arxivdagi (ketgan) xodim — sahifada belgi uchun.
      ...(["", null, undefined].includes(emp.archReason as string | null | undefined) ? {} : { archived: true }),
      createdDate: createdIso(emp.created),
      percent: percent ?? 0,
      // Shu oyda o'quvchilari to'lagan pul MINUS ularga qaytarilgani —
      // foizli oylik asosi (loadCollectedByTeacher izohiga qarang).
      collected: collected.collected,
      refunded: collected.refunded,
      // Ustoz almashuvi izohlari — `collected` allaqachon bo'lingan.
      ...(collected.handovers?.length ? { handovers: collected.handovers } : {}),
      futureCollected: 0,
      bonus: sumFor(bonusesOfMonth, k),
      jarima: sumFor(penaltiesOfMonth, k),
      paidAvans: paid.avans,
      paidOylik: paid.oylik,
      carryOver,
      carryNote:
        carryOver > 0 ? `${prevMonth} oyidan qolgan`
        : carryOver < 0 ? `${prevMonth} oyidan qarzdorlik`
        : "",
      // Soliq faqat xodimga ATAYLAB biriktirilgan turlar bo'yicha
      // hisoblanadi. Sozlamalarda o'chirilgan yoki o'chirib tashlangan
      // qoida `taxById` da bo'lmaydi va o'z-o'zidan tushib qoladi.
      taxable: empTaxRules.length > 0,
      taxRules: empTaxRules,
      // NOMINAL plastik summa — soliq asosi. Davrga bog'liq emas.
      plastikSalary: plastikSalaryOf(emp),
      // Shu oyda kartadan allaqachon berilgani — karta oyog'ining qolgan
      // maqsadini hisoblash uchun. Soliq asosiga TA'SIR QILMAYDI.
      paidPlastik: paid.plastik,
    } satisfies EmployeePayroll;
  });
}

/**
 * Filial ko'rinishi uchun avans/oylikni KASSA bo'yicha ham yig'adi.
 *
 * NEGA KERAK: jadval xodim bo'yicha (`payrollBranchId`) quriladi, "Berilgan
 * avans" kartochkasi esa ilgari o'sha qatorlarning yig'indisi edi. Faol
 * xodimlarning deyarli hammasi 1-filial ro'yxatida, shu bois 2-filial
 * kassiri (Dilmurod) Chortoq o'qituvchilariga bergan avans 1-filial
 * sahifasida chiqar, o'z filialida esa ko'rinmas edi. O'lchandi (sentabr
 * 2026): Dilmurod kassasidan 8 253 000 avans chiqqan, 2-filial sahifasida
 * 2 740 000 turgan; qolgan 5 513 000 1-filialning 55 789 000 ichida edi.
 * Foydalanuvchi qarori (23.09.2026): pul kim bergan bo'lsa, o'sha
 * kassaning filialida ko'rinsin.
 *
 * KASSA FILIALI — `cashboxes.branchId` ("Jami tushum" kartochkasi bilan
 * bir xil qamrov, app/api/salary-runs/month-cashflow). Oy qoidasi esa
 * jadval qatorlari bilan bir xil (`loadPayoutEntries` → `monthMatch`),
 * ya'ni barcha filial kartochkalari yig'indisi barcha qatorlar
 * yig'indisiga teng bo'ladi (filialga biriktirilmagan kassa bo'lmasa).
 *
 * HISOBGA TA'SIR QILMAYDI: qatorlarga faqat ko'rsatish uchun
 * `paidElsewhere` qo'shiladi, `paidAvans`/`paidOylik` o'zgarmaydi — xodimning
 * qolgan oyligidan qaysi kassadan olgani emas, HAMMA olgani ushlab qolinadi.
 *
 * `rows` — shu filialning oylik ro'yxati (`buildPayrollRows` natijasi).
 */
export async function attachBranchPayouts(
  db: Db,
  month: string,
  branchId: number,
  rows: EmployeePayroll[],
): Promise<{ rows: EmployeePayroll[]; given: BranchPayouts }> {
  const [entries, boxes, branches, emps] = await Promise.all([
    loadPayoutEntries(db, month),
    db.collection("cashboxes").find({}, { projection: { _id: 0, id: 1, branchId: 1 } }).toArray(),
    db.collection("branches").find({}, { projection: { _id: 0, id: 1, name: 1 } }).toArray(),
    // Arxivdagilar ham o'qiladi: ular ro'yxatda yo'q, lekin ularga
    // berilgan pul kartochka izohida kimga ketgani bilan ko'rinsin.
    db.collection("hr_employees").find({}, { projection: { _id: 0, name: 1, payrollBranchId: 1, archReason: 1 } }).toArray(),
  ]);

  const toBranchId = (v: unknown): number | null => {
    const n = Number(v);
    return v === null || v === undefined || v === "" || !Number.isFinite(n) ? null : n;
  };
  const branchOfBox = new Map(boxes.map((b) => [Number(b.id), toBranchId(b.branchId)]));
  const branchName = new Map(branches.map((b) => [Number(b.id), String(b.name ?? "")]));
  const nameOfBranch = (id: number | null | undefined) => (id == null ? "" : branchName.get(id) ?? "");
  // Ismdosh bo'lsa FAOL xodim ustun — arxivdagi ismdosh uni yashirmasin.
  const empOf = new Map<string, { branch: number | null; archived: boolean }>();
  for (const e of emps) {
    const k = nameKey(e.name);
    if (!k) continue;
    const archived = !["", null, undefined].includes(e.archReason);
    const prev = empOf.get(k);
    if (!prev || (prev.archived && !archived)) empOf.set(k, { branch: toBranchId(e.payrollBranchId), archived });
  }
  const inList = new Set(rows.map((e) => nameKey(e.name)));

  let avans = 0;
  let oylik = 0;
  const fromOthers = { avans: 0, oylik: 0 };
  const toOthers = new Map<string, BranchPayouts["toOthers"][number]>();
  const elsewhere = new Map<string, Map<string, PaidElsewhere>>();
  for (const r of entries) {
    const amount = Math.abs(Number(r.amount) || 0);
    if (!amount) continue;
    const k = nameKey(r.studentName);
    const kind = payoutKind(r);
    const boxBranch = branchOfBox.get(Number(r.cashboxId)) ?? null;
    if (boxBranch === branchId) {
      // SHU FILIAL KASSASIDAN chiqqan — kimga bo'lsa ham kartochkaga kiradi.
      if (kind === "oylik") oylik += amount;
      else avans += amount;
      if (!inList.has(k)) {
        const emp = empOf.get(k);
        const cur = toOthers.get(k) ?? {
          name: String(r.studentName ?? "").trim(),
          branch: nameOfBranch(emp?.branch),
          archived: emp?.archived ?? false,
          avans: 0,
          oylik: 0,
        };
        cur[kind] += amount;
        toOthers.set(k, cur);
      }
    } else if (k && inList.has(k)) {
      // Shu filial xodimi BOSHQA kassadan olgan — qatorda izoh bo'lib turadi.
      fromOthers[kind] += amount;
      const label = nameOfBranch(boxBranch);
      const byBranch = elsewhere.get(k) ?? new Map<string, PaidElsewhere>();
      const cur = byBranch.get(label) ?? { branch: label, avans: 0, oylik: 0 };
      cur[kind] += amount;
      byBranch.set(label, cur);
      elsewhere.set(k, byBranch);
    }
  }

  return {
    rows: rows.map((e) => {
      const x = elsewhere.get(nameKey(e.name));
      return x ? { ...e, paidElsewhere: [...x.values()] } : e;
    }),
    given: {
      hasCashbox: boxes.some((b) => toBranchId(b.branchId) === branchId),
      avans,
      oylik,
      toOthers: [...toOthers.values()].sort((a, b) => b.avans + b.oylik - (a.avans + a.oylik)),
      fromOthers,
    },
  };
}
