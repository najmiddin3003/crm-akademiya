import type { Db } from "mongodb";
import { SETTINGS_LIST_KINDS } from "@/lib/settingsLists";
import { fixedSalaryOf, isSalaryConfigured, type HrEmployee } from "@/lib/hrEmployees";
import { payrollMonthKey, payrollPeriod, prevMonthKey, prevMonthName, type EmployeePayroll, type PayrollPeriod } from "@/lib/salary";
import { loadTaxRules } from "@/lib/taxes";

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

export interface PaidByEmployee {
  avans: number;
  oylik: number;
}

/**
 * Shu oyda xodimlarga kassadan chiqarilgan avans va oylik.
 * Manba: `transaction_entries` — chiqim yozuvida xodim ismi `studentName`
 * da turadi (app/api/cashboxes/[id]/adjust/route.ts), kategoriya `txName` da.
 * Bekor qilinganlar hisobga olinmaydi.
 */
export async function loadPaidByEmployee(db: Db, month: string): Promise<Map<string, PaidByEmployee>> {
  const rows = await db
    .collection("transaction_entries")
    .find({
      txType: "payOut",
      date: { $regex: `^${month}-` },
      status: { $ne: "cancelled" },
      txName: { $regex: "avans|oylik", $options: "i" },
    })
    .toArray();

  const map = new Map<string, PaidByEmployee>();
  for (const r of rows) {
    const k = nameKey(r.studentName);
    if (!k) continue; // egasi ko'rsatilmagan yozuv hech kimga tegishli emas
    const cur = map.get(k) ?? { avans: 0, oylik: 0 };
    const amount = Math.abs(Number(r.amount) || 0);
    if (/oylik/i.test(String(r.txName ?? ""))) cur.oylik += amount;
    else cur.avans += amount;
    map.set(k, cur);
  }
  return map;
}

/**
 * Shu oyda har bir o'qituvchi orqali tushgan pul — foizli oylik uchun asos.
 * Manba: `transaction_entries` kirim yozuvlaridagi `teacherName`, ya'ni
 * to'lagan o'quvchining ustozi (app/api/cashboxes/[id]/adjust/route.ts).
 * Bekor qilinganlar hisobga olinmaydi.
 */
export async function loadCollectedByTeacher(db: Db, month: string): Promise<Map<string, number>> {
  const rows = await db
    .collection("transaction_entries")
    .find({
      txType: "payIn",
      date: { $regex: `^${month}-` },
      status: { $ne: "cancelled" },
      teacherName: { $nin: ["", null] },
    })
    .toArray();

  const map = new Map<string, number>();
  for (const r of rows) {
    const k = nameKey(r.teacherName);
    if (!k) continue;
    map.set(k, (map.get(k) ?? 0) + Math.abs(Number(r.amount) || 0));
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
 * O'tgan oyda yopilgan hisobdan o'tadigan qoldiq, ISHORALI:
 *   musbat — akademiya xodimga qarzdor (to'lanmagan oylik),
 *   manfiy — XODIM akademiyaga qarzdor.
 *
 * NIMA NOTO'G'RI EDI: bu yerda `amount > 0` sharti turardi, ya'ni faqat
 * akademiyaning qarzi o'tardi. Xodimning qarzi (manfiy qoldiq) esa
 * o'tmasdi va butunlay yo'qolardi. Amaldagi holat: o'qituvchiga avans
 * berilgan, keyin uni qoplagan o'quvchi to'lovi bekor qilingan —
 * o'qituvchida olingan, lekin ishlanmagan pul qoladi. Endi u manfiy
 * `carryOver` sifatida keyingi oyga o'tadi va o'sha oyning hisobidan
 * ushlab qolinadi.
 *
 * Bir oyda bir necha marta oylik chiqarilgan bo'lsa, xodim uchun ENG
 * OXIRGI chiqarishdagi qoldiq olinadi (avvalgisi allaqachon eskirgan).
 * Ilgari `findOne` ishlatilardi — u tartibsiz bitta yozuvni olardi va
 * boshqa chiqarishlardagi xodimlar umuman tushib qolardi.
 */
export async function loadCarryOver(db: Db, p: PayrollPeriod): Promise<Map<number, number>> {
  const prevRuns = await db
    .collection("salary_runs")
    .find({ month: prevMonthKey(p) })
    .sort({ id: 1 })
    .toArray();

  const map = new Map<number, number>();
  for (const run of prevRuns) {
    for (const it of (run?.items ?? []) as { employeeId?: number; amount?: number }[]) {
      const id = Number(it?.employeeId);
      const amount = Number(it?.amount);
      // NOL QIYMAT HAM YOZILADI. Ilgari bu yerda `amount === 0` ni tashlab
      // yuboradigan shart turardi va u endi ZARARLI: chiqarish pulni
      // haqiqatan to'lagandan keyin to'liq yopilgan xodimda qoldiq aynan
      // 0 bo'ladi (app/api/salary-runs/route.ts → `amount: empDue - empPaid`).
      // Shart qolsa, o'sha oydagi AVVALGI chiqarishda yozilgan manfiy qoldiq
      // (xodim qarzi) map'da qolib ketardi va allaqachon yopilgan qarz
      // keyingi oy oyligidan IKKINCHI marta ushlab qolinardi.
      if (!Number.isFinite(id) || !Number.isFinite(amount)) continue;
      map.set(id, amount);
    }
  }
  return map;
}

/**
 * Barcha xodimlar uchun oylik qatorlarini HAQIQIY ma'lumotdan yig'adi.
 * Yagona manba — buni employees-payroll, salary-runs va Xodimlar ro'yxati
 * birgalikda ishlatadi, shunda uchala ekran bir xil raqam ko'rsatadi.
 */
export async function buildPayrollRows(db: Db): Promise<EmployeePayroll[]> {
  const p = payrollPeriod();
  const [employees, bonusRows, penaltyRows, paidBy, percentByTier, carryBy, collectedBy, taxRules] = await Promise.all([
    db.collection<HrEmployee>("hr_employees").find({}).sort({ id: 1 }).toArray(),
    db.collection("bonuses").find({ type: "employee", status: { $ne: "cancelled" } }).toArray(),
    db.collection("penalties").find({ type: "employee", status: { $ne: "cancelled" } }).toArray(),
    loadPaidByEmployee(db, payrollMonthKey(p)),
    loadPercentByTier(db),
    loadCarryOver(db, p),
    loadCollectedByTeacher(db, payrollMonthKey(p)),
    loadTaxRules(db),
  ]);

  const prevMonth = prevMonthName(p);
  // Soliq qoidalari id bo'yicha — har bir xodim o'ziga biriktirilganini oladi.
  const taxById = new Map(taxRules.map((r) => [r.id, r]));
  const sumFor = (rows: { recipientName?: string; amount?: number }[], k: string) =>
    rows.filter((r) => nameKey(r.recipientName) === k).reduce((s, r) => s + (Number(r.amount) || 0), 0);

  return employees.map((emp) => {
    const k = nameKey(emp.name);
    const paid = paidBy.get(k) ?? { avans: 0, oylik: 0 };
    const fixedSalary = fixedSalaryOf(emp);
    const hasOklad = isSalaryConfigured(emp);
    const percent = resolvePercent(emp.percent, percentByTier);
    const carryOver = carryBy.get(emp.id) ?? 0;
    const collected = collectedBy.get(k) ?? 0;
    const empTaxRules = (Array.isArray(emp.taxIds) ? emp.taxIds : [])
      .map((id) => taxById.get(Number(id)))
      .filter((r): r is NonNullable<typeof r> => Boolean(r));

    // Ikki xil ish haqi bo'lishi mumkin va ikkalasi ham SOZLAMA hisoblanadi:
    //   • oklad — xodim kartasidagi filial bo'yicha ish haqi,
    //   • foiz  — o'qituvchiga biriktirilgan daraja (Oylik foizlari).
    // Ikkalasi ham yo'q bo'lsa xodim sozlanmagan.
    const salaryType: "foiz" | "fixed" = hasOklad ? "fixed" : "foiz";
    const configured = hasOklad || percent !== null;

    return {
      id: emp.id,
      name: emp.name,
      phone: emp.phone,
      turi: emp.turi ?? "teacher",
      configured,
      salaryType,
      fixedSalary,
      percent: percent ?? 0,
      // Shu oyda o'quvchilari to'lagan pul — foizli oylik asosi.
      collected,
      futureCollected: 0,
      bonus: sumFor(bonusRows as { recipientName?: string; amount?: number }[], k),
      jarima: sumFor(penaltyRows as { recipientName?: string; amount?: number }[], k),
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
    } satisfies EmployeePayroll;
  });
}
