import type { Db } from "mongodb";
import { groupWeekdays, toIsoDate, type AttendanceMark } from "@/lib/attendance";
import type { Group } from "@/lib/groups";
import type { GroupTask } from "@/lib/groupTasks";
import { LEGACY_COLLECTION, type LegacyEntry } from "@/lib/legacyEntries";
import type { MonthlyExam, UzbmbExam } from "@/lib/imtihon";
import type { NewsItem } from "@/lib/news";
import { pupilEntryMatch } from "@/lib/pupilEntries";
import { pupilFullName, type Pupil } from "@/lib/pupilsData";
import { isStudentRefundEntry, type TransactionEntry } from "@/lib/transactionEntries";
import { uzNow } from "@/lib/uzTime";

// O'quvchilar boti KO'RSATADIGAN ma'lumot. FAQAT O'QISH — bu fayldagi
// birorta funksiya hech narsa yozmaydi.
//
// QAMROV QOIDASI: har bir funksiya `pupilId` (yoki o'quvchining ismi)
// oladi va FAQAT o'sha o'quvchining ma'lumotini qaytaradi. Filial
// qamrovi (lib/branchScope.ts) bu yerda QO'LLANMAYDI va qo'llanmasligi
// ham kerak — u XODIM qaysi filialni ko'rishini cheklaydi, o'quvchi esa
// xodim emas: u o'z ma'lumotini qaysi filialda o'qishidan qat'i nazar
// ko'radi. Chegara boshqa joyda: chaqiruvchi `pupilId` ni faqat
// `student_bot_users` dagi tasdiqlangan bog'lanishdan oladi
// (lib/studentBot/router.ts), foydalanuvchi yuborgan qiymatdan emas.

/** Regexp belgilarini zararsizlantiradi (ism ichida "(" bo'lishi mumkin). */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Yig'indi uchun: bekor qilingan yozuv 0 sifatida qo'shiladi. */
const notCancelled = { $cond: [{ $eq: ["$status", "cancelled"] }, 0, "$amount"] };

/** O'quvchining to'liq hujjati — parol xeshlarisiz. */
export async function loadPupil(db: Db, pupilId: number): Promise<Pupil | null> {
  const row = await db.collection("pupils").findOne(
    { id: pupilId },
    { projection: { _id: 0, studentPasswordHash: 0, parentPasswordHash: 0 } },
  );
  return (row as unknown as Pupil | null) ?? null;
}

/** Bir nechta o'quvchi — farzand tanlash ro'yxati uchun. */
export async function loadPupilNames(db: Db, ids: number[]): Promise<Map<number, string>> {
  if (ids.length === 0) return new Map();
  const rows = await db
    .collection("pupils")
    .find({ id: { $in: ids } }, { projection: { _id: 0, id: 1, firstName: 1, lastName: 1 } })
    .toArray();
  const out = new Map<number, string>();
  for (const r of rows) {
    out.set(Number(r.id), pupilFullName(r as unknown as Pupil));
  }
  return out;
}

export async function branchName(db: Db, branchId: unknown): Promise<string> {
  if (typeof branchId !== "number") return "";
  const row = await db.collection("branches").findOne({ id: branchId }, { projection: { _id: 0, name: 1 } });
  return typeof row?.name === "string" ? row.name : "";
}

/**
 * O'quvchi a'zo bo'lgan guruhlar.
 *
 * `groups` da 91 hujjat bor, shu bois `studentIds` bo'yicha indeks
 * qo'shilmadi — skaner baribir arzon.
 */
export async function loadGroups(db: Db, pupilId: number): Promise<Group[]> {
  const rows = await db
    .collection("groups")
    .find({ studentIds: pupilId }, { projection: { _id: 0 } })
    .toArray();
  return rows as unknown as Group[];
}

/**
 * O'quvchining davomat belgilari. `month` — "YYYY-MM" (berilmasa hammasi).
 *
 * Indeks: `{ pupilId: 1, date: -1 }` (lib/mongodb.ts). Mavjud qo'shma
 * indeks `{ groupId, pupilId, date }` bu so'rovga YARAMAYDI — uning
 * birinchi ustuni `groupId`, bu yerda esa guruh berilmagan.
 */
export async function loadAttendance(db: Db, pupilId: number, month?: string): Promise<AttendanceMark[]> {
  const filter: Record<string, unknown> = { pupilId };
  if (month) filter.date = { $gte: `${month}-01`, $lte: `${month}-31` };
  const rows = await db
    .collection("attendance")
    .find(filter, { projection: { _id: 0 } })
    .sort({ date: 1 })
    .toArray();
  return rows as unknown as AttendanceMark[];
}

/** Davomat belgilari bor oylar — "◀ oldingi oy" tugmasi shu ro'yxat bo'yicha yuradi. */
export async function attendanceMonths(db: Db, pupilId: number): Promise<string[]> {
  const dates = (await db.collection("attendance").distinct("date", { pupilId })) as string[];
  const months = new Set<string>();
  for (const d of dates) {
    if (typeof d === "string" && d.length >= 7) months.add(d.slice(0, 7));
  }
  return [...months].sort();
}

/** Bot ko'rsatadigan bitta to'lov qatori — jonli va arxiv yozuvlar uchun umumiy shakl. */
export interface PaymentRow {
  /** "YYYY-MM-DD" */
  date: string;
  /** Ishorali: to'lov musbat, o'quvchiga qaytarilgan pul MANFIY. */
  amount: number;
  method: string;
  cancelled: boolean;
  /** Edutizimdan ko'chirilgan eski yozuvmi. */
  archive: boolean;
  /** O'quvchiga pul QAYTARILGAN yozuv (lib/studentRefund.ts). */
  refund: boolean;
}

export interface PaymentsView {
  /** KO'RSATISH uchun oxirgi yozuvlar — `limit` bilan kesilgan. */
  rows: PaymentRow[];
  /**
   * Bekor qilinmagan JONLI to'lovlar yig'indisi MINUS o'quvchiga
   * qaytarilgani — CRM'dagi "Balans" bilan bir xil qoida
   * (lib/studentRefund.ts → studentBalanceMatch).
   */
  liveTotal: number;
  /** Arxiv yig'indisi (edutizim davri). */
  archiveTotal: number;
  /** Ikkala manbadagi JAMI yozuvlar soni — "va yana N ta" satri uchun. */
  totalCount: number;
}

/**
 * To'lov tarixi: jonli yozuvlar + edutizim arxivi.
 *
 * IKKI MANBA, ATAYLAB AJRATILGAN — o'quvchi profilidagi "Tranzaksiyalar
 * tarixi" tabi bilan bir xil sabab (components/students/
 * TranzaksiyaTabContent.tsx): CRM'ning balans hisobi FAQAT
 * `transaction_entries` ni ko'radi, arxiv esa pul hisobiga umuman
 * kirmaydi. Ikkalasi bitta songa qo'shib yuborilsa, o'quvchi botda
 * ko'rgan raqam bilan kassadagi xodim ko'rgan raqam bir-biriga mos
 * kelmay qolardi.
 *
 * JONLI YOZUV O'QUVCHI ID'SI BO'YICHA topiladi (lib/pupilEntries.ts).
 * Ilgari ism bo'yicha edi va bu ENG OG'IR joyi bo'lgan: bola botda
 * BEGONA, ismdosh o'quvchining to'lovlarini va balansini ko'rardi
 * (bazada 545 ta ism takrorlanadi). Endi `pupilId` belgilangan yozuv
 * faqat o'z egasiga ko'rinadi; belgilanmagan eskilari esa eskicha ism
 * bo'yicha qo'shiladi — CRM'dagi profil bilan bir xil qoida.
 * Arxivda `pupilId` ancha oldin bor edi (ko'chirishda telefon orqali
 * topilgan) va o'sha ishlatiladi.
 */
/**
 * ARXIV (edutizim davri) SUKUT BO'YICHA QO'SHILMAYDI.
 *
 * Markaz qarori (10.09.2026): o'quvchiga hozircha faqat jonli
 * to'lovlar ko'rsatiladi. Eski tizimdan ko'chirilgan yozuvlar
 * o'quvchida savol tug'dirardi va CRM'ning balans hisobiga ham
 * kirmaydi.
 *
 * Kod O'CHIRILMADI, faqat o'chirib qo'yildi: `includeArchive: true`
 * bilan qaytarish bitta argument. "Hozircha" degan so'z aynan
 * shuni bildiradi.
 */
export async function loadPayments(
  db: Db,
  pupil: Pupil,
  limit = 20,
  includeArchive = false,
): Promise<PaymentsView> {
  const name = pupilFullName(pupil).trim();
  // To'lovlar VA o'quvchiga qaytarilgan pul — CRM balansi bilan bir xil
  // to'plam (lib/studentRefund.ts → studentBalanceMatch), faqat bu yerda
  // bekor qilinganlar ham ro'yxatga kiradi (pastdagi izoh). Oddiy chiqim
  // (`payOut` bayroqsiz) KIRMAYDI: u yerda `studentName` — xodim ismi
  // bo'lishi mumkin (avans/oylik).
  const liveMatch = {
    $and: [
      pupilEntryMatch({ id: pupil.id, name }),
      { $or: [{ txType: "payIn" }, { txType: "payOut", studentRefund: true }] },
    ],
  };

  const [live, legacy, liveAgg, legacyAgg] = await Promise.all([
    name
      ? (db
          .collection("transaction_entries")
          .find(liveMatch, { projection: { _id: 0, date: 1, amount: 1, paymentType: 1, status: 1, txType: 1, studentRefund: 1 } })
          .sort({ date: -1 })
          .limit(limit)
          .toArray() as unknown as Promise<TransactionEntry[]>)
      : Promise.resolve([] as TransactionEntry[]),
    includeArchive
      ? (db
          .collection(LEGACY_COLLECTION)
          .find({ pupilId: pupil.id }, { projection: { _id: 0, date: 1, amount: 1, paymentType: 1, status: 1 } })
          .sort({ date: -1 })
          .limit(limit)
          .toArray() as unknown as Promise<LegacyEntry[]>)
      : Promise.resolve([] as LegacyEntry[]),
    // YIG'INDI ALOHIDA HISOBLANADI — yuqoridagi ro'yxatdan EMAS.
    //
    // NIMA NOTO'G'RI BO'LARDI: ro'yxat `limit` bilan kesiladi, ya'ni
    // 20 tadan ko'p to'lovi bor o'quvchida yig'indi haqiqiydan KAM
    // chiqardi — va bu shunchaki noqulaylik emas, botda PUL haqidagi
    // yolg'on raqam bo'lardi. Endi yig'indi butun to'plam bo'yicha
    // bazada hisoblanadi.
    //
    // `n` HAMMA yozuvni sanaydi, `total` esa faqat bekor qilinmaganini
    // qo'shadi. Ikkalasi boshqacha bo'lishi SHART: ro'yxatda bekor
    // qilingan qatorlar ham ko'rinadi (o'chirilgan to'lov o'quvchi uchun
    // muhim ma'lumot), lekin ular pulga qo'shilmaydi. Sanoq filtrlansa
    // "va yana N ta" satri noto'g'ri chiqardi.
    name
      ? db.collection("transaction_entries").aggregate([
          { $match: liveMatch },
          { $group: { _id: null, total: { $sum: notCancelled }, n: { $sum: 1 } } },
        ]).toArray()
      : Promise.resolve([]),
    includeArchive
      ? db.collection(LEGACY_COLLECTION).aggregate([
          { $match: { pupilId: pupil.id } },
          { $group: { _id: null, total: { $sum: notCancelled }, n: { $sum: 1 } } },
        ]).toArray()
      : Promise.resolve([]),
  ]);

  const rows: PaymentRow[] = [
    ...live.map((e) => ({
      date: String(e.date ?? ""),
      amount: Number(e.amount) || 0,
      method: String(e.paymentType ?? ""),
      cancelled: e.status === "cancelled",
      archive: false,
      refund: isStudentRefundEntry(e),
    })),
    ...legacy.map((e) => ({
      date: String(e.date ?? ""),
      amount: Number(e.amount) || 0,
      method: String(e.paymentType ?? ""),
      cancelled: e.status === "cancelled",
      archive: true,
      refund: false,
    })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    // Ikkala manbadan `limit` tadan olindi, ya'ni birlashgan ro'yxat ikki
    // barobar bo'lishi mumkin. Xabar Telegramning 4096 belgi chegarasiga
    // urilmasin uchun ko'rsatiladigan qism yana bir marta kesiladi.
    .slice(0, limit);

  const num = (agg: { total?: unknown }[], key: "total" | "n") =>
    Number((agg[0] as Record<string, unknown> | undefined)?.[key] ?? 0) || 0;

  return {
    rows,
    liveTotal: num(liveAgg, "total"),
    archiveTotal: num(legacyAgg, "total"),
    totalCount: num(liveAgg, "n") + num(legacyAgg, "n"),
  };
}

/** Guruh topshiriqlari — muddati yaqinlari birinchi. */
export async function loadTasks(db: Db, groupIds: number[]): Promise<GroupTask[]> {
  if (groupIds.length === 0) return [];
  const rows = await db
    .collection("group_tasks")
    .find({ groupId: { $in: groupIds } }, { projection: { _id: 0 } })
    .sort({ id: -1 })
    .limit(30)
    .toArray();
  return rows as unknown as GroupTask[];
}

export interface ExamsView {
  monthly: MonthlyExam[];
  uzbmb: UzbmbExam[];
}

/**
 * Imtihon natijalari.
 *
 * ISM BO'YICHA: `monthly_exams` va `uzbmb_exams` da `student` — matn
 * maydon, o'quvchi id'si yo'q. To'lovlardagi bilan bir xil cheklov.
 */
export async function loadExams(db: Db, pupil: Pupil): Promise<ExamsView> {
  const name = pupilFullName(pupil).trim();
  if (!name) return { monthly: [], uzbmb: [] };
  const rx = { $regex: `^${escapeRegex(name)}$`, $options: "i" };

  const [monthly, uzbmb] = await Promise.all([
    db.collection("monthly_exams").find({ student: rx }, { projection: { _id: 0 } })
      .sort({ month: -1 }).limit(12).toArray(),
    db.collection("uzbmb_exams").find({ student: rx }, { projection: { _id: 0 } })
      .sort({ month: -1 }).limit(12).toArray(),
  ]);

  return {
    monthly: monthly as unknown as MonthlyExam[],
    uzbmb: uzbmb as unknown as UzbmbExam[],
  };
}

/** Markaz yangiliklari — hammaga bir xil, o'quvchiga bog'liq emas. */
export async function loadNews(db: Db, limit = 5): Promise<NewsItem[]> {
  const rows = await db
    .collection("news")
    .find({}, { projection: { _id: 0 } })
    .sort({ id: -1 })
    .limit(limit)
    .toArray();
  return rows as unknown as NewsItem[];
}

export interface NextLesson {
  group: Group;
  /** "YYYY-MM-DD" */
  iso: string;
  /** JS `getDay()`: 0=Yakshanba … 6=Shanba. */
  weekday: number;
  /** Bugundan necha kun keyin (0 — bugun). */
  inDays: number;
}

/**
 * Keyingi dars kuni.
 *
 * Guruhning `day` maydonidan (lib/attendance.ts → `groupWeekdays`)
 * hisoblanadi: "Toq kunlar", "Juft kunlar", "Du,Ju" kabi qiymatlar
 * hafta kunlariga aylantiriladi va bugundan boshlab 14 kun oldinga
 * qaraladi.
 *
 * DIQQAT — bu JADVAL, hodisa emas. Bazada "bugun dars bo'ladi" degan
 * alohida yozuv yo'q: bayram, ustozning kasalligi yoki ko'chirilgan
 * dars bu hisobda ko'rinmaydi. Shu bois matnda "jadval bo'yicha" deb
 * yoziladi — o'quvchi buni kafolat deb o'qimasin.
 *
 * `day` tanilmasa (bo'sh yoki g'alati qiymat) — `null`. To'qib
 * chiqarilgan sana ko'rsatishdan ko'ra hech narsa ko'rsatmaslik yaxshi.
 */
export function nextLesson(groups: Group[], from: Date = uzNow()): NextLesson | null {
  let best: NextLesson | null = null;

  for (const group of groups) {
    const weekdays = groupWeekdays(group.day);
    if (weekdays.length === 0) continue;

    for (let offset = 0; offset <= 14; offset++) {
      const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + offset);
      if (!weekdays.includes(d.getDay())) continue;
      const candidate: NextLesson = { group, iso: toIsoDate(d), weekday: d.getDay(), inDays: offset };
      // Bir nechta guruhda o'qiydigan o'quvchida ENG YAQINI ko'rsatiladi.
      if (!best || candidate.inDays < best.inDays) best = candidate;
      break;
    }
  }
  return best;
}
