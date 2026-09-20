import type { Db } from "mongodb";
import { withBranch, type BranchScope } from "@/lib/branchScope";
import { studentBalanceMatch } from "@/lib/studentRefund";
import { groupLabel, type Group } from "@/lib/groups";
import { pupilFullName, pupilStatusOf, type Pupil } from "@/lib/pupilsData";
import type { DebtIssue, DebtorGroupPart, DebtorRow, DebtorsReport, GroupIssue } from "@/lib/debtorsTypes";
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
//   • BITTA DARS NARXI — Oflayn kurslar bo'limidagi "Bitta dars narxi"
//     (`offline_courses`): guruhning bosqichi (`level`) bo'lsa va shu
//     filialda bosqich narxi (`levels[].branches[].summa`) kiritilgan bo'lsa
//     — o'sha; aks holda kursning filial narxi (`branches[].price`). Ikkalasi
//     ham yo'q — narx NOMA'LUM (issue "price"): summa to'qib chiqarilmaydi.
//     Foydalanuvchi qoidasi: "1 oyda 13 ta dars bo'ladi har bitta fanda" —
//     kursdagi dars narxi aynan oylik ÷ 13 (LESSONS_PER_MONTH,
//     scripts/set-course-prices.mjs); sahifa oylik ekvivalentni shundan
//     ko'rsatadi.
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
 * Guruh uchun bitta dars narxi (yuqoridagi qoida). `null` — topilmadi.
 *
 * Musbat bo'lmagan narx (0) "kiritilmagan" deb olinadi: kurs formasi
 * o'chirilgan filialga ham `price: 0` yozadi.
 */
export function lessonPriceFor(
  group: Pick<GroupDoc, "course" | "level" | "branchId">,
  courses: PricedCourse[],
): number | null {
  const course = findCourseByName(courses, group.course || "");
  if (!course) return null;
  // Maydoni yo'q eski guruh 1-filialniki (lib/branchScope.ts → branchCondition).
  const branchId = Number(group.branchId) || 1;

  const levelKey = norm(group.level);
  if (levelKey) {
    const level = (course.levels ?? []).find((l) => norm(l.name) === levelKey);
    const lb = level?.branches?.find((b) => Number(b.id) === branchId && b.enabled);
    if (lb && Number(lb.summa) > 0) return Number(lb.summa);
  }
  const cb = (course.branches ?? []).find((b) => Number(b.id) === branchId && b.enabled);
  if (cb && Number(cb.price) > 0) return Number(cb.price);
  return null;
}

/** Guruh darslari hali boshlanmagan holat (lib/groupRules.ts → "gathering"). */
const NOT_STARTED_STATUS = "gathering";

const minIso = (a: string, b: string | null) => (b !== null && b < a ? b : a);
const maxIso = (a: string, b: string | null) => (b !== null && b > a ? b : a);

export async function computeDebtors(db: Db, scope: BranchScope, asOf: string): Promise<DebtorsReport> {
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
  if (groups.length === 0) return { asOf, rows: [], issues: [] };
  const groupById = new Map(groups.map((g) => [g.id, g]));

  // 2) A'zolik oraliqlari — shu guruhlar bo'yicha hammasi (yopilganlari ham).
  const memberships = await db
    .collection<GroupMembership>(GROUP_MEMBERSHIPS)
    .find(
      { groupId: { $in: groups.map((g) => g.id) } },
      { projection: { _id: 0, groupId: 1, pupilId: 1, joinedAt: 1, leftAt: 1 } },
    )
    .toArray();
  if (memberships.length === 0) return { asOf, rows: [], issues: [] };

  // 3) O'quvchilar, kurs narxlari, to'lovlar — parallel.
  const pupilIds = [...new Set(memberships.map((m) => m.pupilId))];
  const [pupils, courses, payments] = await Promise.all([
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
    // To'langan — balans qoidasi + sana chegarasi. Yig'indi Mongo'da, ism
    // kaliti JS'da (app/api/students/balances/route.ts izohiga qarang:
    // o'zbek harflarida `$toLower` ishonchsiz).
    db
      .collection("transaction_entries")
      .aggregate<{ _id: unknown; total: number }>([
        { $match: { $and: [studentBalanceMatch(), { date: { $lte: asOf } }] } },
        { $group: { _id: "$studentName", total: { $sum: "$amount" } } },
      ])
      .toArray(),
  ]);
  const pupilById = new Map(pupils.map((p) => [p.id, p]));

  const paidByName = new Map<string, number>();
  for (const r of payments) {
    const key = norm(String(r._id ?? ""));
    if (!key) continue;
    paidByName.set(key, (paidByName.get(key) ?? 0) + (Number(r.total) || 0));
  }

  // Guruh bo'yicha bir marta hisoblanadigan narsalar.
  const priceByGroup = new Map<number, number | null>();
  const priceOf = (g: GroupDoc): number | null => {
    if (!priceByGroup.has(g.id)) priceByGroup.set(g.id, lessonPriceFor(g, courses));
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

  for (const m of memberships) {
    const g = groupById.get(m.groupId);
    const p = pupilById.get(m.pupilId);
    if (!g || !p) continue;
    if ((g.status || "") === NOT_STARTED_STATUS) continue;

    const issues: DebtIssue[] = [];
    const lessonPrice = priceOf(g);
    if (lessonPrice === null) issues.push("price");
    if (groupWeekdays(g.day).length === 0) issues.push("schedule");

    // Boshlangan kun: a'zolik sanasi, bo'lmasa guruh boshi; guruh boshidan
    // oldin sanalmaydi.
    const groupStart = groupStartIso(g);
    const joined = isoDateOrNull(m.joinedAt);
    const start = joined !== null ? maxIso(joined, groupStart) : groupStart;
    if (start === null) issues.push("start");

    // Tugash kuni: hisob sanasi, undan oldin — chiqarilgan kun, guruh tugashi,
    // muzlatilgan kun. Muzlatilgan o'quvchi guruhda qoladi, lekin dars
    // olmaydi; arxivlangan esa a'zolikdan chiqariladi (leftAt).
    let end = minIso(asOf, isoDateOrNull(m.leftAt));
    end = minIso(end, groupEndIso(g));
    if ((g.status || "") === "archive") end = minIso(end, isoDateOrNull(g.archivedAt));
    if (pupilStatusOf(p) === "Muzlatilgan") end = minIso(end, isoDateOrNull(p.statusChangedAt));

    const counted = start !== null && issues.length === 0 ? lessonDaysBetween(g.day, start, end) : { count: 0, last: null };
    for (const issue of issues) addIssue(g, issue);

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
    const paid = paidByName.get(norm(name)) ?? 0;
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
  return { asOf, rows, issues };
}
