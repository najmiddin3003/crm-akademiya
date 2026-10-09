import type { Db } from "mongodb";
import { ENTRY_PAID_EXPR } from "@/lib/transactionEntries";
import { withBranch, type BranchScope } from "@/lib/branchScope";
import { branchPool } from "@/lib/branchPools";
import { studentBalanceMatch } from "@/lib/studentRefund";
import { groupLabel, type Group } from "@/lib/groups";
import { pupilFullName, pupilStatusOf, type Pupil } from "@/lib/pupilsData";
import { lessonsPerMonthFor, type DebtIssue, type DebtorGroupPart, type DebtorRow, type DebtorsReport, type GroupIssue, type MonthlySummary } from "@/lib/debtorsTypes";
import { findCourseByName } from "@/lib/courseLevels";
import { groupWeekdays } from "@/lib/attendance";
import {
  GROUP_MEMBERSHIPS,
  groupEndIso,
  groupStartIso,
  isoDateOrNull,
  lessonDaysBetween,
  type GroupMembership,
} from "@/lib/groupMembership";

// QARZDOR O'QUVCHILAR — hisobot mantig'i (server). Sahifa: /reports-unpaid,
// route: app/api/reports/debtors, bosh sahifadagi "Qarzdorlar" kartasi ham
// shu funksiyadan sanaydi.
//
// QOIDA (foydalanuvchi bilan kelishilgan, 20.09.2026):
//
//   qarz = (guruh jadvali bo'yicha o'tgan darslar × bitta dars narxi) − to'langan
//
//   • DARSLAR SONI — GURUH JADVALIDAN: `groups.day` ("Toq kunlar", "Juft
//     kunlar", "Hafta kunlari", "Du,Ju"… — lib/attendance.ts →
//     groupWeekdays) bo'yicha BOSHLANGAN KUNdan HISOB SANASIgacha (ikkalasi
//     ham kiradi) tushadigan har bir dars kuni. Davomat qo'yilgan-qo'yilmagani
//     AHAMIYATSIZ (foydalanuvchi: "guruhning darsi qaysi kuni bo'lsa avtomatik
//     hisoblashi kerak"). Bayram kunlari HAM sanaladi (foydalanuvchi qarori:
//     "bayram kunida ham hisoblanishi kerak").
//     20.09.2026 gacha darslar `attendance` belgilaridan sanalardi — davomat
//     hech qachon qo'yilmagani uchun hisobot doim bo'sh edi.
//
//   • BOSHLANGAN KUN — o'quvchining shu guruhdagi a'zoligi
//     (`group_memberships.joinedAt`, lib/groupMembership.ts); u noma'lum
//     bo'lsa (backfill) — guruhning boshlanish sanasi (`startDate`/`period`).
//     Ikkalasi ham yo'q → hisoblab bo'lmaydi (issue "start"). Guruh
//     boshlanishidan oldingi kun sanalmaydi (max(joinedAt, guruh boshi)).
//
//   • TUGASH KUNI — hisob sanasi, lekin undan oldin: a'zolik yopilgan kun
//     (`leftAt` — guruhdan chiqarilgan/arxivlangan), guruhning tugash sanasi,
//     arxivlangan guruhda arxivlangan kun (`archivedAt`), "Muzlatilgan"
//     o'quvchida muzlatilgan kun (`pupils.statusChangedAt`).
//     "Yig'ilayotgan" (gathering) guruh darslari boshlanmagan — sanalmaydi.
//
//   • NARX — Oflayn kurslar bo'limidagi OYLIK narx (`offline_courses`; rasmiy
//     2026–2027 ro'yxat, scripts/set-course-prices.mjs): guruhning bosqichi
//     (`level`) bo'lsa va shu filialda bosqich narxi (`levels[].branches[].summa`)
//     kiritilgan bo'lsa — o'sha; aks holda kursning filial narxi
//     (`branches[].price`). Ikkalasi ham yo'q — narx NOMA'LUM (issue "price").
//     BITTA DARS NARXI = oylik ÷ shu guruh jadvalidagi oylik darslar soni
//     (lib/debtorsTypes.ts → lessonsPerMonthFor: haftasiga 3 kun → 13,
//     5 kun → 22, 2 kun → 9) — foydalanuvchi qoidasi "1 oyda 13 ta dars"
//     3 kunlik jadval uchun; har kuni o'qiydigan guruh (topik) ham oyiga
//     aynan oylik narxni to'laydi.
//
//   • TO'LANGAN — /api/students/balances bilan AYNAN bir xil manba va shart
//     (lib/studentRefund.ts → studentBalanceMatch: bekor qilinmagan payIn
//     minus o'quvchiga qaytarim), ustiga `date <= asOf`. To'lov yozuvida
//     o'quvchi id'si YO'Q, faqat ismi — shu bois bog'lanish ism bo'yicha
//     (`trim().toLowerCase()`), balans sahifalaridagi qoida bilan bir xil.
//     To'lov guruhga bog'lanmaydi (yozuvda `group` bo'sh), shuning uchun
//     qarz O'QUVCHI bo'yicha: barcha guruhlaridagi hisob − barcha to'lovi.
//
// QAMROV: guruhlar JORIY FILIAL bo'yicha (`withBranch`, /groups bilan bir
// xil). O'quvchilar ATAYLAB hovuz bilan kesilmaydi: qarz darslar bo'lib
// o'tgan filialga tegishli — o'quvchi keyinchalik boshqa filialga
// o'tkazilgan bo'lsa ham, bu yerdagi darslari shu yerda ko'rinishi kerak.
// Guruhga qo'shishning o'zi (POST /api/groups/:id/students) o'quvchini
// hovuz bo'yicha tekshiradi, ya'ni oddiy holatda ikkalasi baribir mos.
//
// Tiplar va LESSONS_PER_MONTH — lib/debtorsTypes.ts (mijoz ham o'qiydi).

const norm = (s: string | undefined | null) => String(s ?? "").trim().toLowerCase();

/**
 * `offline_courses` hujjatining narx uchun kerak bo'lgan qismi
 * (components/offline-courses/OfflineCoursesProvider.tsx → OfflineCourse
 * bilan bir xil maydonlar). O'sha tip ATAYLAB import qilinmaydi:
 * scripts/gen-api-permissions.mjs importlarni kuzatib, Provider ichidagi
 * "/api/offline-courses" havolalarini /reports-unpaid sahifasiga ham
 * ochib yuborardi (kurs yaratish/o'chirish API'si hisobot ruxsati bilan).
 */
interface PricedCourse {
  name: string;
  branches?: { id: number; enabled: boolean; price: number }[];
  levels?: { name: string; branches?: { id: number; enabled: boolean; summa: number }[] }[];
}

/**
 * `groups` hujjati — `Group` tipida `branchId` yo'q, bazada esa bor (POST
 * /api/groups yozadi); `archivedAt` — arxivlangan kun (PATCH /api/groups/:id).
 */
type GroupDoc = Group & { branchId?: number | null; archivedAt?: string | null };

/**
 * Oylik narx bundan kichik bo'lishi mumkin emas (ro'yxatdagi eng pasti
 * 280 000). Kichigi — eski "bitta dars narxi" (21 538 kabi) qolib ketgan
 * hujjat: uni oylik deb olsak qarz 13 barobar kam chiqardi. Shunday qiymat
 * "narx kiritilmagan" deb olinadi — sahifada ogohlantirish chiqadi,
 * scripts/set-course-prices.mjs qayta yurgiziladi.
 */
const MIN_MONTHLY_PRICE = 50_000;

/**
 * Guruh uchun OYLIK narx (yuqoridagi qoida). `null` — topilmadi.
 *
 * Musbat bo'lmagan narx (0) "kiritilmagan" deb olinadi: kurs formasi
 * o'chirilgan filialga ham `price: 0` yozadi.
 */
export function monthlyPriceFor(
  group: Pick<GroupDoc, "course" | "level" | "branchId">,
  courses: PricedCourse[],
): number | null {
  const course = findCourseByName(courses, group.course || "");
  if (!course) return null;
  // Maydoni yo'q eski guruh 1-filialniki (lib/branchScope.ts → branchCondition).
  const branchId = Number(group.branchId) || 1;
  // 1+2 HOVUZI (09.10.2026, lib/branchPools.ts): guruhning `branchId` si —
  // uni yaratgan navbar filiali, bino emas. Avval o'z filiali qatori, u
  // yo'q yoki o'chiq bo'lsa — hovuzdosh filial qatori. Aks holda bir xil
  // kursdagi umumiy ro'yxat guruhlari jimgina kurs asosiy narxiga tushardi.
  const order = [branchId, ...branchPool(branchId).filter((b) => b !== branchId)];

  const levelKey = norm(group.level);
  if (levelKey) {
    const level = (course.levels ?? []).find((l) => norm(l.name) === levelKey);
    for (const bid of order) {
      const lb = level?.branches?.find((b) => Number(b.id) === bid && b.enabled);
      if (lb && Number(lb.summa) >= MIN_MONTHLY_PRICE) return Number(lb.summa);
    }
  }
  for (const bid of order) {
    const cb = (course.branches ?? []).find((b) => Number(b.id) === bid && b.enabled);
    if (cb && Number(cb.price) >= MIN_MONTHLY_PRICE) return Number(cb.price);
  }
  return null;
}

/** Guruh jadvali uchun oydagi darslar soni (lib/debtorsTypes.ts → lessonsPerMonthFor). */
export function lessonsPerMonthOf(day: string | undefined | null): number {
  return lessonsPerMonthFor(groupWeekdays(day).length);
}

/** Bitta dars narxi = oylik ÷ shu jadvaldagi oylik darslar soni. */
export function lessonPriceOf(monthly: number | null, day: string | undefined | null): number | null {
  return monthly === null ? null : Math.round(monthly / lessonsPerMonthOf(day));
}

/** Guruh darslari hali boshlanmagan holat (lib/groupRules.ts → "gathering"). */
const NOT_STARTED_STATUS = "gathering";

const minIso = (a: string, b: string | null) => (b !== null && b < a ? b : a);
const maxIso = (a: string, b: string | null) => (b !== null && b > a ? b : a);

/** "2026-09" → oyning birinchi va oxirgi kuni ("YYYY-MM-DD"). */
function monthBounds(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

/**
 * @param month — ixtiyoriy "YYYY-MM": berilsa javobda shu oy jamlanmasi
 *   (`month`) ham qaytadi — oy bo'yicha KUTILAYOTGAN pul (oyning hamma dars
 *   kunlari, hisob sanasidan keyingilari ham) va shu oyda TUSHGAN pul.
 */
export async function computeDebtors(db: Db, scope: BranchScope, asOf: string, month?: string): Promise<DebtorsReport> {
  const mb = month ? monthBounds(month) : null;
  const emptyMonth: MonthlySummary | undefined = month
    ? { month, expected: 0, received: 0, remaining: 0, students: 0, lessons: 0 }
    : undefined;

  // 1) Joriy filial guruhlari — arxivlanganlari ham (a'zolik davridagi
  //    darslar qarz bo'lib qoladi). `arxivTugaganGuruhlarimiz` ga qaralmaydi:
  //    o'tgan mavsum, a'zolik yozuvlari ham u guruhlarga yo'q.
  const groups = await db
    .collection<GroupDoc>("groups")
    .find(withBranch({}, scope), {
      projection: {
        _id: 0, id: 1, name: 1, course: 1, level: 1, teacher: 1, branchId: 1,
        day: 1, startDate: 1, endDate: 1, period: 1, status: 1, archivedAt: 1,
      },
    })
    .toArray();
  if (groups.length === 0) return { asOf, rows: [], issues: [], month: emptyMonth };
  const groupById = new Map(groups.map((g) => [g.id, g]));

  // 2) A'zolik oraliqlari — shu guruhlar bo'yicha hammasi (yopilganlari ham).
  const memberships = await db
    .collection<GroupMembership>(GROUP_MEMBERSHIPS)
    .find(
      { groupId: { $in: groups.map((g) => g.id) } },
      { projection: { _id: 0, groupId: 1, pupilId: 1, joinedAt: 1, leftAt: 1 } },
    )
    .toArray();
  if (memberships.length === 0) return { asOf, rows: [], issues: [], month: emptyMonth };

  // 3) O'quvchilar, kurs narxlari, to'lovlar — parallel.
  const pupilIds = [...new Set(memberships.map((m) => m.pupilId))];
  // To'langan — balans qoidasi + sana chegarasi. Yig'indi Mongo'da,
  // kalit JS'da (app/api/students/balances/route.ts izohiga qarang:
  // o'zbek harflarida `$toLower` ishonchsiz).
  //
  // GURUHLASH ID BO'YICHA. Ilgari faqat `studentName` edi va ismdosh
  // o'quvchilar bir-birining to'lovini "to'lagan" deb ko'rsatardi —
  // qarzi bor bola hisobotdan tushib qolardi (lib/pupilEntries.ts).
  // `pupilId` siz ESKI yozuvlar pastda ism bo'yicha qo'shiladi.
  const paidBetween = (from: string | null, to: string) =>
    db
      .collection("transaction_entries")
      .aggregate<{ _id: { pupilId?: unknown; name?: unknown }; total: number }>([
        { $match: { $and: [studentBalanceMatch(), { date: from ? { $gte: from, $lte: to } : { $lte: to } }] } },
        // Tanga evaziga chegirma ham TO'LANGAN hisoblanadi (lib/transactionEntries.ts →
        // discountSom): markaz kechgan qism qarz bo'lib qolmasin.
        { $group: { _id: { pupilId: "$pupilId", name: "$studentName" }, total: { $sum: ENTRY_PAID_EXPR } } },
      ])
      .toArray();
  const [pupils, courses, payments, monthPayments] = await Promise.all([
    db
      .collection<Pupil>("pupils")
      .find(
        { id: { $in: pupilIds } },
        { projection: { _id: 0, id: 1, firstName: 1, lastName: 1, phone: 1, status: 1, statusChangedAt: 1 } },
      )
      .toArray(),
    db
      .collection<PricedCourse>("offline_courses")
      .find({}, { projection: { _id: 0, name: 1, branches: 1, levels: 1 } })
      .toArray(),
    paidBetween(null, asOf),
    mb ? paidBetween(mb.from, mb.to) : Promise.resolve([]),
  ]);
  const pupilById = new Map(pupils.map((p) => [p.id, p]));

  // `pupils.id` -> to'langan summa. `pupilId` bor yozuv TO'G'RIDAN-TO'G'RI
  // egasiga; belgilanmagan eskilari esa ism bo'yicha — o'sha ismli
  // o'quvchi(lar)ga. Ikkinchisi bugungi xatti-harakat: backfill
  // (scripts/backfill-entry-pupil-id.mjs) uni asta-sekin yo'qotadi.
  const sumByPupil = (rows: { _id: { pupilId?: unknown; name?: unknown }; total: number }[]) => {
    const byId = new Map<number, number>();
    const legacy = new Map<string, number>();
    for (const r of rows) {
      const total = Number(r.total) || 0;
      const pid = Number(r._id?.pupilId);
      if (Number.isFinite(pid)) {
        byId.set(pid, (byId.get(pid) ?? 0) + total);
        continue;
      }
      const key = norm(String(r._id?.name ?? ""));
      if (key) legacy.set(key, (legacy.get(key) ?? 0) + total);
    }
    if (legacy.size > 0) {
      for (const p of pupils) {
        const extra = legacy.get(norm(pupilFullName(p))) ?? 0;
        if (extra) byId.set(p.id, (byId.get(p.id) ?? 0) + extra);
      }
    }
    return byId;
  };
  const paidByPupil = sumByPupil(payments);
  const monthPaidByPupil = sumByPupil(monthPayments);

  // Guruh bo'yicha bir marta hisoblanadigan narsalar.
  const priceByGroup = new Map<number, number | null>();
  const monthlyOf = (g: GroupDoc): number | null => {
    if (!priceByGroup.has(g.id)) priceByGroup.set(g.id, monthlyPriceFor(g, courses));
    return priceByGroup.get(g.id) ?? null;
  };

  // (o'quvchi → guruh → qism). Bitta o'quvchining bitta guruhda bir nechta
  // a'zolik oralig'i bo'lishi mumkin (chiqarilib, qayta qo'shilgan) —
  // darslari qo'shiladi, boshlangan kun — eng erta.
  const parts = new Map<number, Map<number, DebtorGroupPart>>();
  const issueByGroup = new Map<string, GroupIssue>();
  const addIssue = (g: GroupDoc, issue: DebtIssue) => {
    const key = `${g.id}:${issue}`;
    if (!issueByGroup.has(key)) {
      issueByGroup.set(key, { groupId: g.id, group: groupLabel(g), course: g.course || "", level: g.level || "", issue });
    }
  };
  // Oy jamlanmasi: o'quvchi → shu oydagi hisob (kutilayotgan).
  const monthExpectedByPupil = new Map<number, number>();
  let monthLessons = 0;

  for (const m of memberships) {
    const g = groupById.get(m.groupId);
    const p = pupilById.get(m.pupilId);
    if (!g || !p) continue;
    if ((g.status || "") === NOT_STARTED_STATUS) continue;

    const issues: DebtIssue[] = [];
    const monthlyPrice = monthlyOf(g);
    const lessonPrice = lessonPriceOf(monthlyPrice, g.day);
    if (monthlyPrice === null) issues.push("price");
    if (groupWeekdays(g.day).length === 0) issues.push("schedule");

    // Boshlangan kun: a'zolik sanasi, bo'lmasa guruh boshi; guruh boshidan
    // oldin sanalmaydi.
    const groupStart = groupStartIso(g);
    const joined = isoDateOrNull(m.joinedAt);
    const start = joined !== null ? maxIso(joined, groupStart) : groupStart;
    if (start === null) issues.push("start");

    // Tugash chegarasi (hisob sanasidan MUSTAQIL qismi): chiqarilgan kun,
    // guruh tugashi, arxivlangan kun, muzlatilgan kun. Muzlatilgan o'quvchi
    // guruhda qoladi, lekin dars olmaydi; arxivlangan esa a'zolikdan
    // chiqariladi (leftAt).
    const bounds: (string | null)[] = [isoDateOrNull(m.leftAt), groupEndIso(g)];
    if ((g.status || "") === "archive") bounds.push(isoDateOrNull(g.archivedAt));
    if (pupilStatusOf(p) === "Muzlatilgan") bounds.push(isoDateOrNull(p.statusChangedAt));
    let bound: string | null = null;
    for (const b of bounds) if (b !== null) bound = bound === null ? b : minIso(bound, b);
    const end = minIso(asOf, bound);

    const ok = start !== null && issues.length === 0;
    const counted = ok ? lessonDaysBetween(g.day, start, end) : { count: 0, last: null };
    for (const issue of issues) addIssue(g, issue);

    // Oy jamlanmasi — oyning HAMMA dars kunlari (bugundan keyingilari ham),
    // a'zolik/guruh chegaralari ichida.
    if (mb && ok && lessonPrice !== null) {
      const inMonth = lessonDaysBetween(g.day, maxIso(mb.from, start), minIso(mb.to, bound)).count;
      if (inMonth > 0) {
        monthLessons += inMonth;
        monthExpectedByPupil.set(m.pupilId, (monthExpectedByPupil.get(m.pupilId) ?? 0) + inMonth * lessonPrice);
      }
    }

    let perGroup = parts.get(m.pupilId);
    if (!perGroup) parts.set(m.pupilId, (perGroup = new Map()));
    const prev = perGroup.get(g.id);
    if (!prev) {
      perGroup.set(g.id, {
        groupId: g.id,
        group: groupLabel(g),
        course: g.course || "",
        level: g.level || "",
        teacher: g.teacher || "",
        lessons: counted.count,
        startDate: start,
        lastDate: counted.last,
        monthlyPrice,
        lessonsPerMonth: lessonsPerMonthOf(g.day),
        lessonPrice,
        charged: lessonPrice === null ? 0 : counted.count * lessonPrice,
        issues,
      });
    } else {
      prev.lessons += counted.count;
      prev.charged = prev.lessonPrice === null ? 0 : prev.lessons * prev.lessonPrice;
      if (start !== null && (prev.startDate === null || start < prev.startDate)) prev.startDate = start;
      if (counted.last !== null && (prev.lastDate === null || counted.last > prev.lastDate)) prev.lastDate = counted.last;
      for (const issue of issues) if (!prev.issues.includes(issue)) prev.issues.push(issue);
    }
  }

  const rows: DebtorRow[] = [];
  for (const [pupilId, perGroup] of parts) {
    const p = pupilById.get(pupilId);
    if (!p) continue;
    // Darsi ham, muammosi ham yo'q qism (hisob sanasidan keyin qo'shilgan)
    // ko'rsatilmaydi — "0 × narx = 0" qatori ma'lumot bermaydi.
    const groupParts = [...perGroup.values()]
      .filter((x) => x.lessons > 0 || x.issues.length > 0)
      .sort((a, b) => a.group.localeCompare(b.group));
    if (groupParts.length === 0) continue;
    const lessons = groupParts.reduce((s, x) => s + x.lessons, 0);
    const incomplete = groupParts.some((x) => x.issues.length > 0);

    const name = pupilFullName(p);
    const charged = groupParts.reduce((s, x) => s + x.charged, 0);
    const paid = paidByPupil.get(p.id) ?? 0;
    const starts = groupParts.map((x) => x.startDate).filter((d): d is string => d !== null);
    rows.push({
      id: p.id,
      name,
      phone: p.phone ?? "",
      status: pupilStatusOf(p),
      groups: groupParts,
      lessons,
      startDate: starts.length ? starts.reduce((min, d) => (d < min ? d : min)) : null,
      charged,
      paid,
      debt: charged - paid,
      incomplete,
    });
  }

  // Eng katta qarz yuqorida; teng bo'lsa ism bo'yicha.
  rows.sort((a, b) => b.debt - a.debt || a.name.localeCompare(b.name));

  const issues = [...issueByGroup.values()].sort((a, b) => a.group.localeCompare(b.group) || a.issue.localeCompare(b.issue));

  // Oy jamlanmasi: kutilayotgan — shu oyda darsi bo'lgan o'quvchilar bo'yicha;
  // tushgan — a'zoligi bor HAMMA o'quvchining shu oydagi to'lovi (darsi hali
  // boshlanmagan bo'lsa ham to'lagan bo'lishi mumkin).
  let monthSummary = emptyMonth;
  if (month && mb) {
    let expected = 0;
    for (const v of monthExpectedByPupil.values()) expected += v;
    let received = 0;
    for (const p of pupils) received += monthPaidByPupil.get(p.id) ?? 0;
    monthSummary = { month, expected, received, remaining: expected - received, students: monthExpectedByPupil.size, lessons: monthLessons };
  }

  return { asOf, rows, issues, month: monthSummary };
}
