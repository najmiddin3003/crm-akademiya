import { NextResponse } from "next/server";
import type { Db, Document, Filter, ObjectId } from "mongodb";
import { ensureIndexes } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";
import { isPathAllowed } from "@/lib/permissions";
import { ROLE_LABELS } from "@/constants/employees";
import { getBranchScope, withBranch, withPupilBranch, type BranchScope } from "@/lib/branchScope";
import { branchPool } from "@/lib/branchPools";
import { withLeadScope } from "@/lib/leadScope";
import { employeeNameById, nameEq } from "@/lib/currentEmployee";
import { branchNameMap, scopedEmployeeFilter } from "@/lib/employeeBranches";
import { phoneSearchPattern } from "@/lib/phoneSearch";
import { pupilFullName, pupilStatusOf, type Pupil } from "@/lib/pupilsData";
import { groupLabel } from "@/lib/groups";
import { holatOf, type HolatSource } from "@/lib/leadHolat";
import {
  SEARCH_CAP,
  SEARCH_MIN,
  looseRegexSource,
  matchScore,
  parseUzStamp,
  planQuery,
  rankTop,
  type GlobalSearchResponse,
  type GroupHit,
  type LeadHit,
  type PaymentHit,
  type QueryPlan,
  type SearchGroup,
  type SearchKind,
  type StaffHit,
  type StudentHit,
} from "@/lib/globalSearch";

// GET /api/search/global?q=… — Ctrl K oynasi (components/v2/shell/CommandPaletteV2.tsx,
// 21-qism · Yuqori panel). Bitta so'rovda besh manba: o'quvchilar, lidlar, guruhlar,
// xodimlar, to'lovlar (chek raqami yoki to'lovchi ismi). Sahifalar va amallar — klientda.
//
// RUXSAT SHU YERDA, MANBA BOSHIGA (/api/notifications naqshi). Route qobiqdan chaqiriladi
// — uni bitta bo'lim ruxsatiga bog'lab bo'lmaydi (ro'yxatda yo'q route — «sessiya
// yetarli», lib/apiPermissions.ts). Har manba O'Z SAHIFASINING ruxsati va qamrovi bilan:
//   o'quvchilar — /students-list, withPupilBranch (GET /api/search/students bilan bir xil);
//   lidlar      — /orders-list, withLeadScope (GET /api/orders: filial + o'zi qo'shganlari);
//   guruhlar    — /groups, withBranch (lib/listQueries.ts → loadGroups);
//   xodimlar    — /management-xodimlar, scopedEmployeeFilter (GET /api/hr-employees);
//   to'lovlar   — admin yoki /finance-transactions — barcha kassalar, faqat /finance-cash —
//                 o'z kassalari (GET /api/cashboxes va qo'ng'iroqdagi to'lovlar bilan bir xil).
// Ruxsati yo'q manba UMUMAN so'ralmaydi va `state: "off"` bilan bo'sh qaytadi — xato emas.
// Qamrov — navbardagi joriy filial (hovuzi bilan): «Barcha filiallar» rejimi yo'q va
// natija ochadigan sahifa ham shu qamrovda (boshqa filial yozuvi ochilmasdi).
//
// Javobda faqat ko'rsatiladigan maydonlar — har manbada aniq proyeksiya: parol, xesh,
// token, `_id` hech qachon chiqmaydi.

/** Bir manbadan tartiblash uchun olinadigan yozuvlar (ko'rsatiladigani — SEARCH_CAP). */
const SCAN = 25;

const PATH = {
  students: "/students-list",
  leads: "/orders-list",
  groups: "/groups",
  staff: "/management-xodimlar",
  payAll: "/finance-transactions",
  payOwn: "/finance-cash",
} as const;

type Mode = "word" | "any";
type Run = (filter: Filter<Document>, limit: number) => Promise<Document[]>;

const str = (v: unknown) => String(v ?? "").trim();
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const sameName = (a: unknown, b: string) => str(a).toLowerCase() === b.trim().toLowerCase();

/**
 * Ism maydonlari bo'yicha shart: HAR so'z biror maydonga mos bo'lishi kerak («ali valiyev» —
 * «ali» ismga, «valiyev» familiyaga; lib/pupilSearch.ts dagi qoida), so'rov ko'rinishlaridan
 * (kirill → lotin, klaviatura tartibi) biri yetarli. Apostrofga chidamli (lib/globalSearch.ts).
 * Aralash so'rovda («ali 9415») raqamli bo'lak telefonga ham urinadi.
 */
function nameClause(plan: QueryPlan, fields: readonly string[], mode: Mode, phoneField?: string): Filter<Document> | null {
  const variants = plan.variantTerms.filter((terms) => terms.length > 0);
  if (variants.length === 0) return null;
  const perVariant: Filter<Document>[] = variants.map((terms) => ({
    $and: terms.map((term) => {
      const rx = { $regex: looseRegexSource(term, mode === "word"), $options: "i" };
      const or: Filter<Document>[] = fields.map((f) => ({ [f]: rx }));
      const p = phoneField ? phoneSearchPattern(term) : null;
      if (phoneField && p) or.push({ [phoneField]: { $regex: p } });
      return { $or: or };
    }),
  }));
  return perVariant.length === 1 ? perVariant[0] : { $or: perVariant };
}

/** Raqamli so'rov: telefon (ajratkichga chidamli, lib/phoneSearch.ts) yoki aniq ID. */
function digitClause(plan: QueryPlan, phoneField: string | null, idField: string | null): Filter<Document> | null {
  const or: Filter<Document>[] = [];
  if (phoneField && plan.phonePattern) or.push({ [phoneField]: { $regex: plan.phonePattern } });
  if (idField && plan.idNumber !== null) or.push({ [idField]: plan.idNumber });
  if (or.length === 0) return null;
  return or.length === 1 ? or[0] : { $or: or };
}

/**
 * Ikki bosqich: avval SO'Z BOSHIDAN (aniqroq — «ali» «Valijon»ni olib kelmaydi), natija
 * kam bo'lsa — ICHIDAN ham, topilganlari takrorlanmaydi. Raqamli so'rovda bitta bosqich.
 */
async function findTwoPhase(run: Run, build: (mode: Mode) => Filter<Document> | null, single: boolean): Promise<Document[]> {
  const first = build("word");
  if (!first) return [];
  const rows = await run(first, SCAN);
  if (single || rows.length >= SEARCH_CAP) return rows;
  const second = build("any");
  if (!second) return rows;
  const seen = rows.map((r) => r.id).filter((v) => v !== undefined && v !== null);
  const rest = await run(seen.length ? { $and: [second, { id: { $nin: seen } }] } : second, SCAN - rows.length);
  return [...rows, ...rest];
}

type Foreign = (branchId: unknown) => string | null;

async function searchStudents(db: Db, plan: QueryPlan, scope: BranchScope, foreign: Foreign): Promise<SearchGroup<StudentHit>> {
  const col = db.collection("pupils");
  const projection = { _id: 0, id: 1, firstName: 1, lastName: 1, phone: 1, balance: 1, category: 1, status: 1, branchId: 1 };
  const rows = await findTwoPhase(
    (f, limit) => col.find(withPupilBranch(f, scope), { projection }).sort({ id: -1 }).limit(limit).toArray(),
    (mode) => (plan.digitsOnly ? digitClause(plan, "phone", "id") : nameClause(plan, ["firstName", "lastName"], mode, "phone")),
    plan.digitsOnly,
  );
  const hits = rows.map((r): StudentHit => {
    const balance = num(r.balance);
    return {
      id: num(r.id),
      name: pupilFullName({ firstName: str(r.firstName), lastName: str(r.lastName) }),
      phone: str(r.phone),
      category: str(r.category),
      debt: balance < 0 ? Math.abs(balance) : 0,
      status: pupilStatusOf({ status: r.status } as Pick<Pupil, "status">),
      branch: foreign(r.branchId),
    };
  });
  return {
    state: "on",
    ...rankTop(hits, (h) =>
      (plan.idNumber !== null && h.id === plan.idNumber ? 100 : plan.digitsOnly ? 50 : matchScore(h.name, plan.raw)) * 10 +
      (h.status === "Aktiv" ? 1 : 0),
    ),
  };
}

async function searchLeads(db: Db, plan: QueryPlan, scope: BranchScope, author: string, foreign: Foreign): Promise<SearchGroup<LeadHit>> {
  const col = db.collection("orders");
  // `_id` — faqat yaratilgan vaqt uchun (javobga chiqmaydi); holat maydonlari — lib/leadHolat.ts → holatOf.
  const projection = {
    _id: 1, id: 1, name: 1, phone: 1, course: 1, source: 1, heardFrom: 1, branchId: 1, created: 1,
    holat: 1, groupId: 1, status: 1, leadStatus: 1, firstLesson: 1, firstLessonStatus: 1, stage: 1,
  };
  const rows = await findTwoPhase(
    (f, limit) => col.find(withLeadScope(f, scope, author), { projection }).sort({ id: -1 }).limit(limit).toArray(),
    (mode) => (plan.digitsOnly ? digitClause(plan, "phone", "id") : nameClause(plan, ["name"], mode, "phone")),
    plan.digitsOnly,
  );
  const now = Date.now();
  const hits = rows.map((r): LeadHit => {
    const holat = holatOf(r as HolatSource);
    let waitingMinutes: number | null = null;
    if (holat === "yangi") {
      const at = parseUzStamp(str(r.created)) ?? (r._id as ObjectId | undefined)?.getTimestamp?.().getTime() ?? null;
      if (at !== null) waitingMinutes = Math.max(0, Math.floor((now - at) / 60_000));
    }
    const source = str(r.source);
    return {
      id: num(r.id),
      name: str(r.name),
      phone: str(r.phone),
      course: str(r.course),
      // «Sayt» — ko'p lidda qattiq yozilgan sukut (asl manba emas) — ko'rsatilmaydi.
      source: str(r.heardFrom) || (source && source !== "Sayt" ? source : ""),
      holat,
      waitingMinutes,
      branch: foreign(r.branchId),
    };
  });
  return {
    state: "on",
    ...rankTop(hits, (h) => (plan.idNumber !== null && h.id === plan.idNumber ? 100 : plan.digitsOnly ? 50 : matchScore(h.name, plan.raw))),
  };
}

const GROUP_ORDER: Record<string, number> = { active: 3, gathering: 2, frozen: 1 };

async function searchGroups(db: Db, plan: QueryPlan, scope: BranchScope, foreign: Foreign): Promise<SearchGroup<GroupHit>> {
  const col = db.collection("groups");
  const projection = { _id: 0, id: 1, name: 1, course: 1, teacher: 1, time: 1, room: 1, status: 1, studentIds: 1, branchId: 1 };
  // «13», «13-guruh» — guruh raqami (nomi) yoki ID si, aniq.
  const numeric = /^(\d{1,6})\s*(?:-?\s*guruh)?$/i.exec(plan.raw)?.[1] ?? null;
  const rows = await findTwoPhase(
    (f, limit) => col.find(withBranch(f, scope), { projection }).sort({ id: -1 }).limit(limit).toArray(),
    (mode) => {
      if (numeric) return { $or: [{ name: numeric }, { id: Number(numeric) }] };
      if (plan.digitsOnly) return null;
      return nameClause(plan, ["course", "teacher", "name"], mode);
    },
    plan.digitsOnly || numeric !== null,
  );
  const scored = rows.map((r) => {
    const id = num(r.id);
    const name = str(r.name);
    const course = str(r.course);
    const hit: GroupHit = {
      id,
      label: groupLabel({ id, name, course }),
      course,
      teacher: str(r.teacher),
      time: str(r.time),
      room: str(r.room),
      // `students` — o'lik hisoblagich; haqiqiy son — studentIds (lib/groupsList.ts → groupStudentCount).
      students: Array.isArray(r.studentIds) ? r.studentIds.length : 0,
      status: str(r.status),
      branch: foreign(r.branchId),
    };
    // Raqam bilan: nomi aynan shu — birinchi, ID si mos kelgani — keyin.
    const base = numeric
      ? (name === numeric ? 100 : 90)
      : Math.max(matchScore(hit.label, plan.raw), matchScore(course, plan.raw), matchScore(hit.teacher, plan.raw));
    return { hit, score: base * 10 + (GROUP_ORDER[hit.status] ?? 0) };
  });
  const ranked = rankTop(scored, (x) => x.score);
  return { state: "on", items: ranked.items.map((x) => x.hit), more: ranked.more };
}

async function searchStaff(db: Db, plan: QueryPlan, scope: BranchScope, names: Map<number, string>): Promise<SearchGroup<StaffHit>> {
  const col = db.collection("hr_employees");
  // Telefon bo'yicha qidiriladi, lekin javobga chiqmaydi (natija qatorida kerak emas).
  const projection = { _id: 0, id: 1, name: 1, turi: 1, centerRoleId: 1, branchIds: 1, archReason: 1 };
  const rows = await findTwoPhase(
    (f, limit) => col.find(scopedEmployeeFilter(f, scope), { projection }).sort({ id: 1 }).limit(limit).toArray(),
    (mode) => (plan.digitsOnly ? digitClause(plan, "phone", "id") : nameClause(plan, ["name"], mode, "phone")),
    plan.digitsOnly,
  );
  // Lavozim — yuqori paneldagi bilan bir xil (lib/uiVersionServer.ts → shellRoleLabel): qo'lda
  // qo'shilgan rol (centerRoleId) — nomi Rollar'dan, aks holda `turi` yorlig'i. Xom `turi`
  // («teacher») ekranga chiqmasin.
  const labels = ROLE_LABELS as Record<string, string>;
  const hasRole = (v: unknown) => v !== null && v !== undefined && Number.isFinite(Number(v));
  const roleIds = [...new Set(rows.filter((r) => hasRole(r.centerRoleId)).map((r) => Number(r.centerRoleId)))];
  const roleNames = new Map<number, string>();
  if (roleIds.length > 0) {
    const roles = await db.collection("roles").find({ id: { $in: roleIds } }, { projection: { _id: 0, id: 1, name: 1 } }).toArray();
    for (const r of roles) if (str(r.name)) roleNames.set(Number(r.id), str(r.name));
  }
  const positionOf = (r: Document): string =>
    hasRole(r.centerRoleId) ? (roleNames.get(Number(r.centerRoleId)) ?? labels.staff) : (labels[str(r.turi)] ?? labels.staff);
  const hits = rows.map((r): StaffHit => {
    const ids: unknown[] = Array.isArray(r.branchIds) ? r.branchIds : [];
    const branchNames = ids.map((b) => names.get(Number(b))).filter((n): n is string => !!n);
    return {
      id: num(r.id),
      name: str(r.name),
      position: positionOf(r),
      groups: 0,
      // Hovuzdagi binolar bir xil nomli («Akademiya Chortoq») — takror chiqmaydi.
      branches: [...new Set(branchNames)],
      archived: Boolean(r.archReason),
    };
  });
  const ranked = rankTop(hits, (h) =>
    (plan.idNumber !== null && h.id === plan.idNumber ? 100 : plan.digitsOnly ? 50 : matchScore(h.name, plan.raw)) * 10 + (h.archived ? 0 : 1),
  );

  // Guruhlar soni — joriy filial hovuzida, arxivda bo'lmagan, o'qituvchi ismi bo'yicha
  // (guruhda ustoz id emas, ism bilan yoziladi; ism solishtirish katta-kichik harfga befarq).
  const named = ranked.items.filter((s) => s.name);
  if (named.length > 0) {
    const groups = await db
      .collection("groups")
      .find(withBranch({ status: { $ne: "archive" }, $or: named.map((s) => ({ teacher: nameEq(s.name) })) }, scope), {
        projection: { _id: 0, teacher: 1 },
      })
      .toArray();
    for (const s of ranked.items) s.groups = groups.filter((g) => sameName(g.teacher, s.name)).length;
  }
  return { state: "on", ...ranked };
}

async function searchPayments(
  db: Db,
  plan: QueryPlan,
  canAll: boolean,
  isAdmin: boolean,
  myName: string,
): Promise<SearchGroup<PaymentHit>> {
  const none = (state: "no-cashbox"): SearchGroup<PaymentHit> => ({ state, items: [], more: false });
  // Faqat `/finance-cash` — o'ziga biriktirilgan kassalar (`cashboxes.moderator` — xodim
  // ISMINING nusxasi, lib/currentEmployee.ts). Ismsiz hisobda kassa yo'q.
  let boxFilter: Filter<Document> = {};
  if (!canAll) {
    if (!myName) return none("no-cashbox");
    boxFilter = { moderator: nameEq(myName) };
  }
  const boxes = await db.collection("cashboxes").find(boxFilter, { projection: { _id: 0, id: 1, name: 1, moderator: 1 } }).toArray();
  const boxIds = boxes.map((b) => Number(b.id)).filter(Number.isFinite);
  if (boxIds.length === 0) return none("no-cashbox");
  const boxName = new Map(boxes.map((b) => [Number(b.id), str(b.name)] as const));
  // Chek oynasi kassa kesimida faqat admin yoki kassa egasiga ochiladi (GET /api/transaction-entries).
  const own = new Set(isAdmin ? boxIds : boxes.filter((b) => myName && sameName(b.moderator, myName)).map((b) => Number(b.id)));

  const col = db.collection("transaction_entries");
  // Faqat KIRIM (o'quvchi to'lovi): `payOut` da `studentName` — xodim ismi (oylik), `transfer` — kassalar orasida.
  const base: Filter<Document> = { txType: "payIn", cashboxId: { $in: boxIds } };
  const projection = { _id: 0, id: 1, studentName: 1, amount: 1, date: 1, paymentType: 1, cashboxId: 1, pupilId: 1, status: 1 };
  const byReceipt = plan.receipt !== null;
  const rows = await findTwoPhase(
    (f, limit) => col.find({ $and: [base, f] }, { projection }).sort({ id: -1 }).limit(limit).toArray(),
    (mode) => {
      if (byReceipt) return { id: plan.receipt };
      if (plan.digitsOnly) return null;
      return nameClause(plan, ["studentName"], mode);
    },
    byReceipt || plan.digitsOnly,
  );
  const hits = rows.map((r): PaymentHit => {
    const cashboxId = num(r.cashboxId);
    const pupilId = Number(r.pupilId);
    return {
      id: num(r.id),
      payer: str(r.studentName),
      amount: Math.abs(num(r.amount)),
      date: str(r.date),
      method: str(r.paymentType),
      cashboxId,
      cashboxName: boxName.get(cashboxId) ?? "",
      pupilId: Number.isFinite(pupilId) && pupilId > 0 ? pupilId : null,
      own: own.has(cashboxId),
      cancelled: r.status === "cancelled",
    };
  });
  return {
    state: "on",
    ...rankTop(hits, (h) => (byReceipt ? (h.id === plan.receipt ? 100 : 0) : matchScore(h.payer, plan.raw))),
  };
}

export async function GET(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });

  const perms = me.permissions;
  const isAdmin = me.role === "admin";
  const can = {
    students: isPathAllowed(PATH.students, perms),
    leads: isPathAllowed(PATH.leads, perms),
    groups: isPathAllowed(PATH.groups, perms),
    staff: isPathAllowed(PATH.staff, perms),
    payAll: isAdmin || isPathAllowed(PATH.payAll, perms),
    payOwn: isPathAllowed(PATH.payOwn, perms),
  };
  const canPay = can.payAll || can.payOwn;
  const off = <T>(on: boolean): SearchGroup<T> => ({ state: on ? "on" : "off", items: [], more: false });

  const plan = planQuery(new URL(req.url).searchParams.get("q") ?? "");
  if (plan.raw.length < SEARCH_MIN) {
    // Bitta harf deyarli butun bazani qaytaradi — bazaga bormaymiz (oyna bunday so'rov yubormaydi).
    const empty: GlobalSearchResponse = {
      ok: true,
      q: plan.raw,
      scope: { branchId: scope.branchId, branchName: "" },
      results: { students: off(can.students), leads: off(can.leads), groups: off(can.groups), staff: off(can.staff), payments: off(canPay) },
    };
    return NextResponse.json(empty);
  }

  const db = await ensureIndexes();
  const [names, myName] = await Promise.all([branchNameMap(db), employeeNameById(db, me.hrEmployeeId)]);
  const pool = branchPool(scope.branchId);
  // Eski yozuvlarda `branchId` yo'q — ular 1-filialniki (lib/branchScope.ts → branchInCondition).
  const foreign: Foreign = (b) => {
    const id = typeof b === "number" && Number.isFinite(b) ? b : 1;
    return pool.includes(id) ? null : (names.get(id) ?? null);
  };
  // Lid muallifi — GET /api/orders dagi `currentAuthorName()` bilan bir xil.
  const leadAuthor = myName || str(me.fullName);

  // Bitta manba yiqilsa qolganlari baribir qaytadi.
  const guard = async <T>(kind: SearchKind, on: boolean, run: () => Promise<SearchGroup<T>>): Promise<SearchGroup<T>> => {
    if (!on) return off<T>(false);
    try {
      return await run();
    } catch (err) {
      console.error(`[search/global] ${kind}:`, err instanceof Error ? err.message : err);
      return { state: "error", items: [], more: false };
    }
  };

  const [students, leads, groups, staff, payments] = await Promise.all([
    guard("students", can.students, () => searchStudents(db, plan, scope, foreign)),
    guard("leads", can.leads, () => searchLeads(db, plan, scope, leadAuthor, foreign)),
    guard("groups", can.groups, () => searchGroups(db, plan, scope, foreign)),
    guard("staff", can.staff, () => searchStaff(db, plan, scope, names)),
    guard("payments", canPay, () => searchPayments(db, plan, can.payAll, isAdmin, myName)),
  ]);

  const body: GlobalSearchResponse = {
    ok: true,
    q: plan.raw,
    scope: { branchId: scope.branchId, branchName: names.get(scope.branchId) ?? "" },
    results: { students, leads, groups, staff, payments },
  };
  return NextResponse.json(body);
}
