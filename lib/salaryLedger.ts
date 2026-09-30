import type { Db } from "mongodb";
import type { HrEmployee } from "@/lib/hrEmployees";
import { buildPayrollRows, loadPayrollRefs } from "@/lib/payrollSources";
import {
  payrollHasFoiz,
  payrollMonthKey,
  payrollOkladPart,
  payrollPeriod,
  payrollPeriodOf,
  type EmployeePayroll,
  type SalaryType,
} from "@/lib/salary";
import { isStudentRefundEntry, type TransactionEntry } from "@/lib/transactionEntries";
import {
  TEACHER_HANDOVERS,
  buildHandoverIndex,
  handoverFor,
  handoverRatio,
  type TeacherHandover,
} from "@/lib/teacherHandover";

// XODIMNING OYLIK DAFTARI — Xodim profili → "Tranzaksiyalar tarixi"
// jadvalidagi "Oyligiga ta'siri" va "Qoldiq oldin/keyin" ustunlari
// (18.09.2026).
//
// NIMA UCHUN KERAK: `transaction_entries.before/after` — yozuv yozilgan
// KASSANING qoldig'i. Xodim profilida u "Kassada oldin/keyin" bo'lib
// turardi va o'quvchi to'lagan 420 000 "xodim hisobiga 420 000 tushdi" deb
// o'qilardi, holbuki foizli o'qituvchiga uning 50 foizi tegishli.
// Foydalanuvchi: "xodim profilidagi jadvalda 50% emas, jami to'lov
// hisoblanyapti". Bu daftar — o'sha jadval uchun XODIMNING O'Z qoldig'i.
//
// QOIDA — lib/payrollSources.ts bilan BIR XIL, ikkinchi nusxa emas:
//   • oy chegarasi: `periodMonth`, u bo'lmasa `date` ning oyi (monthMatch);
//   • oy boshidagi qoldiq: o'tgan oydan qolgan (`loadCarryOver` —
//     yopilgan oyda muzlatilgan, yopilmaganida jonli) — chap kartadagi
//     "To'lanmagan" ham aynan shundan boshlanadi; okladli xodimda unga
//     shu oy okladi (`payrollOkladPart`: o'tgan oyda to'liq, joriy oyda
//     bugungi kungacha pro-rata, ishga kirgan kundan) qo'shiladi;
//   • kirim, `teacherName` — shu xodim, foizli    → +summa × foiz
//   • o'quvchiga qaytarim, `teacherName` — shu xodim → −summa × foiz
//   • chiqim avans/oylik, `studentName` — shu xodim  → −summa (olingan)
//   • faqat okladli xodimda o'quvchi to'lovi oylikka tegmaydi; "oklad +
//     foiz" xodimda ikkalasi ham ishlaydi (oklad oy boshida, foiz
//     yozuvma-yozuv);
//   • USTOZ ALMASHUVI (lib/teacherHandover.ts): eski ustoz to'lovidan
//     faqat oxirgi dars kunigacha bo'lgan ulushni oladi (izohda "20/30
//     kun"), yangi ustozga o'tgan qism uning oy boshiga qo'shiladi;
//   • bekor qilingan yozuv hisobga kirmaydi.
//
// Ya'ni oyning OXIRGI qatoridagi "Qoldiq keyin" = `payrollDue` — bonus,
// jarima va soliqsiz (ular kassa yozuvi emas, jadvalda ko'rinmaydi;
// tooltip shuni aytadi).
//
// ULUSH YAXLITLANMAY yig'iladi, faqat ko'rsatishda yaxlitlanadi: aks holda
// har qatorda ±0.5 so'm yig'ilib, oy yakuni `round(collected × foiz)` dan
// (chap kartadagi raqam) bir necha so'mga farq qilardi.

export interface SalaryLedgerRow {
  /** `transaction_entries.id` — jadval qatori shu bo'yicha topadi. */
  id: number;
  /** Oylik hisobidagi oy ("YYYY-MM") — `periodMonth` yoki `date` oyi. */
  month: string;
  /** Yozuvning shu xodim oyligiga ta'siri, yaxlitlangan, ishorali. */
  effect: number;
  /** "50%", "50% qaytarim", "olingan" — ustundagi izoh. */
  note: string;
  /**
   * Xodim qoldig'i shu yozuvdan oldin/keyin. Ish haqi sozlanmagan xodimda
   * `null` — ishlab topgani hisoblanmaydi, faqat olganini ko'rsatish
   * soxta "qarzdorlik" bo'lardi.
   */
  before: number | null;
  after: number | null;
}

export interface SalaryLedger {
  configured: boolean;
  salaryType: SalaryType;
  percent: number;
  /** Faqat oylikka ta'sir qiladigan yozuvlar, xronologik (id bo'yicha). */
  rows: SalaryLedgerRow[];
}

/** Jadval va daftar o'qiydigan maydonlar. */
export type LedgerEntry = Pick<
  TransactionEntry,
  "id" | "date" | "time" | "txType" | "txName" | "amount" | "discountSom" | "studentName" | "teacherName" | "studentRefund" | "status" | "periodMonth"
>;

function nameKey(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}

/** Yozuv QAYSI OYGA tegishli — payrollSources.ts dagi `monthMatch` bilan bir xil. */
export function payrollMonthOfEntry(e: Pick<TransactionEntry, "date" | "periodMonth">): string {
  const pm = String(e.periodMonth ?? "").trim();
  return pm || String(e.date ?? "").slice(0, 7);
}

/**
 * Yozuvning SHU XODIM OYLIGIGA ta'siri — YAXLITLANMAGAN.
 *
 * `null` — yozuv bu xodimning oyligiga tegmaydi (boshqa ustozning
 * o'quvchisi, kassir sifatida qayd etgani, bekor qilingan, okladli
 * xodimda o'quvchi to'lovi).
 */
export function salaryEffectOf(
  t: LedgerEntry,
  empName: string,
  payroll: Pick<EmployeePayroll, "configured" | "salaryType" | "percent"> | null,
  /**
   * USTOZ ALMASHUVI (lib/teacherHandover.ts): shu to'lovdan ustozda qoladigan
   * ulush (masalan 20/30) va izoh. Yo'q — to'liq.
   */
  split?: { factor: number; note: string } | null,
): { amount: number; note: string } | null {
  if (t.status === "cancelled") return null;
  const me = nameKey(empName);
  if (!me) return null;
  const abs = Math.abs(Number(t.amount) || 0);
  // Avval chiqim: avans yozuvida `teacherName` ham xodimning o'zi bo'lishi
  // mumkin (kassa Chiqim oynasi shunday yozadi) — u ulush emas, olingan pul.
  if (t.txType === "payOut" && nameKey(t.studentName) === me && /avans|oylik/i.test(t.txName || "")) {
    return { amount: -abs, note: "olingan" };
  }
  if (nameKey(t.teacherName) !== me) return null;
  // Foiz qismi bor xodim — "foiz" va "oklad + foiz".
  if (!payroll?.configured || !payrollHasFoiz(payroll)) return null;
  const f = split ? split.factor : 1;
  const tag = split ? ` · ${split.note}` : "";
  const share = abs * payroll.percent / 100 * f;
  if (t.txType === "payIn") {
    // Ustoz foizi to'liq narxdan: tanga evaziga chegirma ham ulushga kiradi
    // (lib/payrollSources.ts → loadCollectedByTeacher bilan bir xil).
    const disc = Math.abs(Number(t.discountSom) || 0);
    return disc
      ? { amount: (abs + disc) * payroll.percent / 100 * f, note: `${payroll.percent}% · chegirma bilan${tag}` }
      : { amount: share, note: `${payroll.percent}%${tag}` };
  }
  if (isStudentRefundEntry(t)) return { amount: -share, note: `${payroll.percent}% qaytarim${tag}` };
  return null;
}

/** Ism bo'yicha Mongo sharti — `nameKey` bilan bir xil: chetidagi probel va harf kattaligi farqlanmaydi. */
function nameMatch(name: string) {
  const escaped = name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return { $regex: `^\\s*${escaped}\\s*$`, $options: "i" };
}

export async function buildSalaryLedger(db: Db, emp: HrEmployee): Promise<SalaryLedger> {
  const name = String(emp.name ?? "").trim();
  const empty: SalaryLedger = { configured: false, salaryType: "foiz", percent: 0, rows: [] };
  if (!name) return empty;

  // Oyga bog'liq bo'lmagan ma'lumot bir marta; xodimlar ro'yxati esa
  // FAQAT shu xodim — `buildPayrollRows` shunda bitta qator hisoblaydi
  // (o'tgan oy qoldig'ining jonli hisobi ham shu bitta xodim uchun).
  // Arxivlangan xodim `loadPayrollRefs` ro'yxatiga tushmaydi — bu yerda
  // u ham ochiq, chunki profil arxivdagi xodimda ham ochiladi.
  const refs = { ...(await loadPayrollRefs(db)), employees: [emp] };
  const rowOf = async (month: string) => {
    const period = payrollPeriodOf(month);
    const [row] = await buildPayrollRows(db, period, { refs });
    return { period, row };
  };

  // Joriy oy har doim o'qiladi: xodim turi/foizi shu qatordan, daftar
  // bo'sh bo'lsa ham (yangi xodim) jadval nima ko'rsatishini bilsin.
  const nowKey = payrollMonthKey(payrollPeriod());
  const current = await rowOf(nowKey);
  const me = current.row;
  if (!me) return empty;

  // Oylikka TA'SIR QILISHI MUMKIN bo'lgan yozuvlar — payrollSources.ts dagi
  // ikki manba bilan bir xil shart: `loadCollectedByTeacher` (kirim va
  // qaytarim, ustoz bo'yicha) va `loadPaidByEmployee` (avans/oylik,
  // xodim bo'yicha). Okladli xodimda ustoz qismi umuman so'ralmaydi.
  const n = nameMatch(name);
  const or: Record<string, unknown>[] = [
    { txType: "payOut", studentName: n, txName: { $regex: "avans|oylik", $options: "i" } },
  ];
  if (me.configured && payrollHasFoiz(me)) {
    or.push({
      $and: [{ $or: [{ txType: "payIn" }, { txType: "payOut", studentRefund: true }] }, { teacherName: n }],
    });
  }
  const [entries, ownHandovers] = await Promise.all([
    db
      .collection("transaction_entries")
      .find({ status: { $ne: "cancelled" }, $or: or })
      .project({
        _id: 0, id: 1, date: 1, time: 1, txType: 1, txName: 1, amount: 1, discountSom: 1,
        studentName: 1, teacherName: 1, studentRefund: 1, status: 1, periodMonth: 1, pupilId: 1,
      })
      // Jadval id bo'yicha kamayish tartibida — daftar ham id bo'yicha yuradi,
      // shunda qatorning "oldin"i keyingi qatorning "keyin"iga teng chiqadi.
      .sort({ id: 1 })
      .toArray() as unknown as Promise<(LedgerEntry & { pupilId?: number })[]>,
    // USTOZ ALMASHUVI — shu xodim ESKI ustoz bo'lgan almashuvlar: uning
    // to'lovlaridan faqat oxirgi dars kunigacha bo'lgan ulushi qoladi
    // (payrollSources.ts → loadCollectedByTeacher bilan bir xil qoida).
    db.collection<TeacherHandover>(TEACHER_HANDOVERS)
      .find({ fromKey: nameKey(name), dismissed: { $ne: true } }, { projection: { _id: 0 } })
      .toArray() as Promise<TeacherHandover[]>,
  ]);
  const handoverIndex = buildHandoverIndex(ownHandovers);
  const splitOf = (e: LedgerEntry & { pupilId?: number }) => {
    if (nameKey(e.teacherName) !== nameKey(name)) return null;
    const match = handoverFor(handoverIndex, payrollMonthOfEntry(e), e);
    if (!match) return null;
    const r = handoverRatio(match.handover);
    return r.old < 1 ? { factor: r.old, note: `${r.oldDays}/${r.daysIn} ${r.unit === "lessons" ? "dars" : "kun"}` } : null;
  };

  const effects = entries
    .map((e) => ({ e, eff: salaryEffectOf(e, name, me, splitOf(e)) }))
    .filter((x): x is { e: LedgerEntry & { pupilId?: number }; eff: { amount: number; note: string } } => x.eff !== null);

  // Har bir oy uchun oy boshidagi qoldiq — o'sha oyning `EmployeePayroll`
  // qatoridan. Oylar bir-biriga bog'liq emas, parallel o'qiladi.
  const months = [...new Set(effects.map((x) => payrollMonthOfEntry(x.e)))];
  const openings = new Map<string, number>();
  if (me.configured) {
    await Promise.all(months.map(async (m) => {
      const { period, row } = m === nowKey ? current : await rowOf(m);
      if (!row) return;
      // Okladli xodimda oklad oy boshida yoziladi (o'tgan oyda to'liq,
      // joriy oyda bugungi kungacha, ishga kirgan kundan); foiz qismi esa
      // yozuvma-yozuv keladi. Faqat foizli xodimda oklad qismi 0.
      //
      // USTOZ ALMASHUVIDA boshqa ustozdan KELGAN ulush ham oy boshiga
      // qo'shiladi: o'sha to'lovlar bu xodimning jadvalida qator bo'lib
      // chiqmaydi (ular eski ustoz nomida), aks holda "Qoldiq" ustuni
      // sababsiz sakrardi.
      const incoming = payrollHasFoiz(row)
        ? (row.handovers ?? []).filter((h) => h.dir === "in").reduce((s, h) => s + h.amount, 0) * row.percent / 100
        : 0;
      openings.set(m, row.carryOver + payrollOkladPart(row, period) + incoming);
    }));
  }

  const running = new Map<string, number>(openings);
  const rows: SalaryLedgerRow[] = effects.map(({ e, eff }) => {
    const month = payrollMonthOfEntry(e);
    const before = running.has(month) ? running.get(month)! : null;
    const after = before === null ? null : before + eff.amount;
    if (after !== null) running.set(month, after);
    return {
      id: e.id,
      month,
      effect: Math.round(eff.amount),
      note: eff.note,
      before: before === null ? null : Math.round(before),
      after: after === null ? null : Math.round(after),
    };
  });

  return { configured: me.configured, salaryType: me.salaryType, percent: me.percent, rows };
}
