import type { Db, Filter } from "mongodb";
import { SETTINGS_LIST_KINDS } from "@/lib/settingsLists";
import { fixedSalaryOf, isSalaryConfigured, plastikSalaryOf, type HrEmployee } from "@/lib/hrEmployees";
import { PLASTIK_METHOD_KEY } from "@/lib/paymentMethods";
import {
  payrollEarned,
  payrollMonthKey,
  payrollPaid,
  payrollPeriod,
  payrollPeriodOf,
  payrollTax,
  prevMonthKey,
  prevMonthName,
  type EmployeePayroll,
  type PayrollPeriod,
} from "@/lib/salary";
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
function monthMatch(month: string) {
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
      // Kirim tomonidagi bilan AYNAN bir xil qoida — `monthMatch` izohiga qarang.
      $or: monthMatch(month),
      status: { $ne: "cancelled" },
      txName: { $regex: "avans|oylik", $options: "i" },
    })
    // Pastdagi tsikl faqat shu to'rttasini o'qiydi. 109 KB -> ~14 KB.
    .project({ studentName: 1, txName: 1, amount: 1, paymentMethodKey: 1, _id: 0 })
    .toArray();

  const map = new Map<string, PaidByEmployee>();
  for (const r of rows) {
    const k = nameKey(r.studentName);
    if (!k) continue; // egasi ko'rsatilmagan yozuv hech kimga tegishli emas
    const cur = map.get(k) ?? { avans: 0, oylik: 0, plastik: 0 };
    const amount = Math.abs(Number(r.amount) || 0);
    if (/oylik/i.test(String(r.txName ?? ""))) cur.oylik += amount;
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
      // QAYSI OYGA tegishli ekani `periodMonth` da (Kirim oynasida
      // tanlanadi): pul sentabrda kelib, avgust darslari uchun bo'lishi
      // mumkin va o'qituvchining foizi AVGUSTGA hisoblanishi kerak.
      //
      // Maydon yo'q yozuvlarda (bu qo'shilishdan oldingilar va import
      // qilinganlar — bazadagi yozuvlarning aksariyati) avvalgidek `date`
      // ning oyi ishlatiladi, ya'ni eski hisob buzilmaydi.
      $or: monthMatch(month),
      status: { $ne: "cancelled" },
      teacherName: { $nin: ["", null] },
    })
    // Pastdagi tsikl faqat shu ikkitasini o'qiydi. 666 KB -> 73 KB.
    .project({ teacherName: 1, amount: 1, _id: 0 })
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
export async function loadCarryOver(db: Db, p: PayrollPeriod, refs?: PayrollRefs): Promise<Map<number, number>> {
  const prev = prevMonthKey(p);
  const prevRuns = await db
    .collection("salary_runs")
    .find({ month: prev })
    .sort({ id: 1 })
    .toArray();

  // O'TGAN OY UMUMAN YOPILMAGAN BO'LSA — QOLDIQ JONLI HISOBLANADI.
  //
  // NIMA NOTO'G'RI EDI: qoldiq FAQAT `salary_runs` dan o'qilardi, ya'ni
  // "O'tgan oydan" ustuni faqat oylik AYNAN SHU SAHIFA orqali chiqarilgan
  // bo'lsagina to'lardi. Amalda esa oyliklar to'g'ridan-to'g'ri kassadan
  // beriladi va `salary_runs` bo'sh — demak ustun hech qachon to'lmasdi va
  // o'tgan oyda ishlab, lekin olinmagan pul keyingi oyga umuman o'tmasdi.
  // (O'lchandi: avgustda 238 745 400 hisoblangan, 114 845 000 to'langan —
  // 121 572 400 so'm hech qayerda ko'rinmasdi.)
  //
  // Endi yopilmagan oy uchun o'sha oyning OCHIQ QOLDIG'I hisoblanadi:
  //   hisoblangan − soliq − to'langan (avans + oylik)
  //
  // ATAYLAB FAQAT BITTA OY ORQAGA qaraladi, zanjir qurilmaydi. Sabab
  // o'lchangan: har bir oyda ~120-160 mln so'm ochiq qoldiq bor va 12 oy
  // zanjiri ekranga 1.5 mlrd so'mlik "qarz" chiqarardi — bu raqamning
  // ortida biznes qarori turadi, kod uni o'zi qabul qila olmaydi. Bir oy
  // esa foydalanuvchi so'ragan holatni to'liq qoplaydi: sentabrda kelib
  // "avgust uchun" deb belgilangan to'lov avgust oyligiga qo'shiladi va
  // olinmagan bo'lsa sentabr sahifasida "O'tgan oydan" bo'lib chiqadi.
  //
  // IKKI MARTA SANASH XAVFI YO'Q: oylik shu sahifadan chiqarilishi bilan
  // `salary_runs` yozuvi paydo bo'ladi va yuqoridagi shox ishlaydi —
  // muzlatilgan qoldiq jonli hisobdan USTUN.
  if (prevRuns.length === 0) {
    // O'TGAN OYDA MOLIYAVIY YOZUV UMUMAN BO'LMASA — O'TKAZILADIGAN QOLDIQ
    // YO'Q.
    //
    // NIMA UCHUN: oklad oladigan xodimning "hisoblangan"i har oy o'z-o'zidan
    // paydo bo'ladi (fixedSalary × kun/kun), "to'langan"i esa faqat kassa
    // yozuvidan keladi. Kassada o'sha oyga oid birorta yozuv bo'lmasa,
    // natija "hamma to'liq to'lanmagan" bo'lib chiqadi va har oy ustma-ust
    // yig'ilib boraveradi — bu QARZ emas, YOZUV YO'QLIGI.
    //
    // Amalda uchradi: to'lovlar jurnali ataylab tozalangandan keyin
    // avgustda 39 000 000 "hisoblangan" ustiga iyuldan 38 412 000 "o'tgan
    // oydan" qo'shilib, hech kim olmagan pul ikki barobar ko'rinardi.
    //
    // Tizim ishlatila boshlashi bilan bu shart o'z-o'zidan ochiladi:
    // o'tgan oyda bitta kirim yoki chiqim bo'lishi kifoya.
    const anyPrev = await db.collection("transaction_entries").countDocuments(
      { $or: monthMatch(prev), status: { $ne: "cancelled" } },
      { limit: 1 },
    );
    if (anyPrev === 0) return new Map();

    const prevPeriod = payrollPeriodOf(prev);
    // `carryOver: false` — REKURSIYA CHEGARASI. Usiz buildPayrollRows
    // yana loadCarryOver ni chaqirib, cheksiz zanjir hosil bo'lardi.
    //
    // `refs` — chaqiruvchi allaqachon o'qigan, OYGA BOG'LIQ BO'LMAGAN
    // ma'lumot (xodimlar, bonus/jarima, foiz darajalari, soliqlar). Uni
    // qayta o'qish o'tgan oy hisobiga 5 ta ortiqcha Atlas so'rovi
    // qo'shardi va sahifa ochilishi ikki barobar sekinlashardi
    // (o'lchandi: 1.5 s → 2.9 s).
    const rows = await buildPayrollRows(db, prevPeriod, { carryOver: false, refs });
    const live = new Map<number, number>();
    for (const e of rows) {
      // Ish haqi sozlanmagan xodimning "hisoblangan"i ma'nosiz (0) —
      // uni qoldiq sifatida o'tkazish soxta raqam bo'lardi.
      if (!e.configured) continue;
      const open = payrollEarned(e, prevPeriod) - payrollTax(e, prevPeriod) - payrollPaid(e);
      if (open !== 0) live.set(e.id, open);
    }
    return live;
  }

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
  const empFilter: Filter<HrEmployee> = { archReason: { $in: ["", null] } } as Filter<HrEmployee>;
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
  const { employees, bonusRows, penaltyRows, percentByTier, taxRules } = refs;
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
