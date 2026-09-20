import type { Db } from "mongodb";
import { withBranch, type BranchScope } from "@/lib/branchScope";
import { studentBalanceMatch } from "@/lib/studentRefund";
import { groupLabel, type Group } from "@/lib/groups";
import { pupilFullName, pupilStatusOf, type Pupil } from "@/lib/pupilsData";
import type { DebtorGroupPart, DebtorRow, DebtorsReport, UnpricedGroup } from "@/lib/debtorsTypes";
import { findCourseByName } from "@/lib/courseLevels";
import type { AttendanceMark } from "@/lib/attendance";

// QARZDOR O'QUVCHILAR — hisobot mantig'i (server). Sahifa: /reports-unpaid,
// route: app/api/reports/debtors, bosh sahifadagi "Qarzdorlar" kartasi ham
// shu funksiyadan sanaydi.
//
// QOIDA (foydalanuvchi bilan kelishilgan, 20.09.2026):
//
//   qarz = (davomatda belgilangan darslar soni × bitta dars narxi) − to'langan
//
//   • DARSLAR SONI — `attendance` kolleksiyasidagi belgilar: o'quvchining
//     shu guruhdagi BIRINCHI belgisidan hisob sanasigacha (`asOf`, shu kun
//     ham kiradi) qo'yilgan HAR BIR belgi, holatidan qat'i nazar (keldi,
//     birinchi dars, sababli, sababsiz). Ya'ni davomat qo'yilgan dars —
//     bo'lib o'tgan dars, u to'lanadi. Davomat qo'yilmagan kun sanalmaydi:
//     jadvaldan (Toq/Juft kunlar) darslar TO'QIB CHIQARILMAYDI, chunki
//     o'quvchi guruhga qachon qo'shilgani `groups.studentIds` da saqlanmaydi
//     va birinchi dars sanasining yagona manbasi — davomat.
//
//   • BITTA DARS NARXI — Oflayn kurslar bo'limidagi "Bitta dars narxi"
//     (`offline_courses`): guruhning bosqichi (`level`) bo'lsa va shu
//     filialda bosqich narxi (`levels[].branches[].summa`) kiritilgan bo'lsa
//     — o'sha; aks holda kursning filial narxi (`branches[].price`). Ikkalasi
//     ham yo'q — narx NOMA'LUM: qator `priceMissing` bilan chiqadi, summa
//     to'qib chiqarilmaydi. Foydalanuvchi qoidasi: "1 oyda 13 ta dars bo'ladi
//     har bitta fanda" — kursdagi dars narxi aynan oylik ÷ 13
//     (LESSONS_PER_MONTH); sahifa oylik ekvivalentni shundan ko'rsatadi.
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

/** `groups` hujjati — `Group` tipida `branchId` yo'q, bazada esa bor (POST /api/groups yozadi). */
type GroupDoc = Group & { branchId?: number | null };

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

interface Tally {
  lessons: number;
  firstDate: string;
  lastDate: string;
}

export async function computeDebtors(db: Db, scope: BranchScope, asOf: string): Promise<DebtorsReport> {
  // 1) Joriy filial guruhlari — holatidan qat'i nazar (arxivlangan guruhning
  //    davomati ham bo'lib o'tgan dars). `arxivTugaganGuruhlarimiz` ga
  //    qaralmaydi: u o'tgan mavsum, davomat yozuvlari ham u guruhlarga yo'q.
  const groups = await db
    .collection<GroupDoc>("groups")
    .find(withBranch({}, scope), {
      projection: { _id: 0, id: 1, name: 1, course: 1, level: 1, teacher: 1, branchId: 1 },
    })
    .toArray();
  if (groups.length === 0) return { asOf, rows: [], unpriced: [] };
  const groupById = new Map(groups.map((g) => [g.id, g]));

  // 2) Davomat belgilari — hisob sanasigacha. Faqat uchta maydon: sanoq
  //    uchun holat ham kerak emas (hamma belgi sanaladi).
  const marks = await db
    .collection<AttendanceMark>("attendance")
    .find(
      { groupId: { $in: groups.map((g) => g.id) }, date: { $lte: asOf } },
      { projection: { _id: 0, groupId: 1, pupilId: 1, date: 1 } },
    )
    .toArray();
  if (marks.length === 0) return { asOf, rows: [], unpriced: [] };

  // (o'quvchi, guruh) → sanoq va chegara sanalar.
  const tally = new Map<number, Map<number, Tally>>();
  for (const m of marks) {
    let perGroup = tally.get(m.pupilId);
    if (!perGroup) tally.set(m.pupilId, (perGroup = new Map()));
    const cur = perGroup.get(m.groupId);
    if (!cur) perGroup.set(m.groupId, { lessons: 1, firstDate: m.date, lastDate: m.date });
    else {
      cur.lessons += 1;
      if (m.date < cur.firstDate) cur.firstDate = m.date;
      if (m.date > cur.lastDate) cur.lastDate = m.date;
    }
  }

  // 3) O'quvchilar (faqat kerakli maydonlar) va kurs narxlari — parallel.
  const pupilIds = [...tally.keys()];
  const [pupils, courses, payments] = await Promise.all([
    db
      .collection<Pupil>("pupils")
      .find({ id: { $in: pupilIds } }, { projection: { _id: 0, id: 1, firstName: 1, lastName: 1, phone: 1, status: 1 } })
      .toArray(),
    db
      .collection<PricedCourse>("offline_courses")
      .find({}, { projection: { _id: 0, name: 1, branches: 1, levels: 1 } })
      .toArray(),
    // 4) To'langan — balans qoidasi + sana chegarasi. Yig'indi Mongo'da,
    //    ism kaliti JS'da (app/api/students/balances/route.ts izohiga qarang:
    //    o'zbek harflarida `$toLower` ishonchsiz).
    db
      .collection("transaction_entries")
      .aggregate<{ _id: unknown; total: number }>([
        { $match: { $and: [studentBalanceMatch(), { date: { $lte: asOf } }] } },
        { $group: { _id: "$studentName", total: { $sum: "$amount" } } },
      ])
      .toArray(),
  ]);

  const paidByName = new Map<string, number>();
  for (const r of payments) {
    const key = norm(String(r._id ?? ""));
    if (!key) continue;
    paidByName.set(key, (paidByName.get(key) ?? 0) + (Number(r.total) || 0));
  }

  // Narx har guruh uchun BIR MARTA hisoblanadi (o'quvchi sayin emas).
  const priceByGroup = new Map<number, number | null>();
  const priceOf = (g: GroupDoc): number | null => {
    if (!priceByGroup.has(g.id)) priceByGroup.set(g.id, lessonPriceFor(g, courses));
    return priceByGroup.get(g.id) ?? null;
  };

  const rows: DebtorRow[] = [];
  const unpricedIds = new Set<number>();
  for (const p of pupils) {
    const perGroup = tally.get(p.id);
    if (!perGroup) continue;

    const parts: DebtorGroupPart[] = [];
    for (const [groupId, tl] of perGroup) {
      const g = groupById.get(groupId);
      if (!g) continue;
      const lessonPrice = priceOf(g);
      if (lessonPrice === null) unpricedIds.add(groupId);
      parts.push({
        groupId,
        group: groupLabel(g),
        course: g.course || "",
        level: g.level || "",
        teacher: g.teacher || "",
        lessons: tl.lessons,
        firstDate: tl.firstDate,
        lastDate: tl.lastDate,
        lessonPrice,
        charged: lessonPrice === null ? 0 : tl.lessons * lessonPrice,
      });
    }
    if (parts.length === 0) continue;
    parts.sort((a, b) => a.group.localeCompare(b.group));

    const name = pupilFullName(p);
    const charged = parts.reduce((s, x) => s + x.charged, 0);
    const paid = paidByName.get(norm(name)) ?? 0;
    rows.push({
      id: p.id,
      name,
      phone: p.phone ?? "",
      status: pupilStatusOf(p),
      groups: parts,
      lessons: parts.reduce((s, x) => s + x.lessons, 0),
      firstDate: parts.reduce((min, x) => (x.firstDate < min ? x.firstDate : min), parts[0].firstDate),
      charged,
      paid,
      debt: charged - paid,
      priceMissing: parts.some((x) => x.lessonPrice === null),
    });
  }

  // Eng katta qarz yuqorida; teng bo'lsa ism bo'yicha.
  rows.sort((a, b) => b.debt - a.debt || a.name.localeCompare(b.name));

  const unpriced: UnpricedGroup[] = [];
  for (const id of unpricedIds) {
    const g = groupById.get(id);
    if (g) unpriced.push({ groupId: g.id, group: groupLabel(g), course: g.course || "", level: g.level || "" });
  }
  unpriced.sort((a, b) => a.group.localeCompare(b.group));

  return { asOf, rows, unpriced };
}
