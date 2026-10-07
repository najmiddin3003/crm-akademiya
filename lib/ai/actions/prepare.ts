import { withPupilBranch } from "@/lib/branchScope";
import { pendingDiscountFor } from "@/lib/gamification/discounts";
import { noteMonthConflict } from "@/lib/noteMonth";
import { formatLessonDays, lessonDaysLabel, parseLessonDays } from "@/lib/ordersData";
import { PLASTIK_METHOD_KEY, type PaymentMethod } from "@/lib/paymentMethods";
import { studentPaidBalance } from "@/lib/pupilsDb";
import { pupilFullName } from "@/lib/pupilsData";
import { pupilSearchFilter } from "@/lib/pupilSearch";
import { payrollMonthKey, payrollPeriod, prevMonthKey } from "@/lib/salary";
import { findBotCashbox, listCashboxesForAdmin, type BotCashbox } from "@/lib/staffBot/auth";
import {
  employeeSalaryInfo,
  loadActiveMethods,
  loadChiqimTypes,
  loadCourseNames,
  loadKirimTypes,
  pupilGroupInfo,
  searchEmployees,
} from "@/lib/staffBot/data";
import { formatPhone } from "@/lib/studentBot/phone";
import { refundTeacherOf } from "@/lib/studentRefund";
import { isEmployeePayoutCategory } from "@/lib/teacherOfStudent";
import type { TransactionType } from "@/lib/transactionTypes";
import { txAudience, txTarget } from "@/lib/txTarget";
import { authorNameOf, type AiContext } from "../context";
import { maskPhone } from "../mask";
import type { AiActionField, AiActionKind } from "../protocol";
import { optInt, optMonth, optString, ToolInputError, type ToolArgs } from "../tools/types";

// AMAL QORALAMASI — model bergan qiymatlarni TEKSHIRIB, yadroga tayyor
// qiladi. Hech narsa YOZMAYDI (qoralamani lib/ai/tools/actions.ts saqlaydi,
// yozuvni esa tasdiqdan keyin lib/ai/actions/execute.ts).
//
// QOIDALAR XODIMLAR BOTIDAN (lib/staffBot/lead.ts, kirim.ts, chiqim.ts) —
// u ham web oynalari bilan bir xil qilib yozilgan va o'sha yadroni
// chaqiradi. Bu yerda faqat KIRISH boshqacha: tugma o'rniga model matni.
// Shu bois model aytgan har qiymat ro'yxatdan qidiriladi (tur, to'lov turi,
// kurs, o'quvchi, xodim) va topilmasa YOKI bir nechta mos kelsa qoralama
// tuzilmaydi — modelga ro'yxat qaytadi va u xodimdan aniqlashtiradi.
// Taxmin qilinmaydi.
//
// Modelga qaytadigan matnlar inglizcha (tizim ko'rsatmasi bilan bir xil,
// lib/ai/prompt.ts) — xodimga model o'z tilida yetkazadi. Kartadagi
// qiymatlar (`fields`) esa CRM'dagi nomlar, o'zgarishsiz.

export interface Draft {
  kind: AiActionKind;
  /** Yadroga ketadigan qiymatlar — bazada qoladi, modelga ko'rsatilmaydi. */
  payload: Record<string, unknown>;
  /** Panel kartasi. */
  fields: AiActionField[];
  /** Modelga qisqa xulosa (telefon yashirilgan). */
  forModel: Record<string, unknown>;
}

/** `reply` — modelga qaytadigan javob: nima yetishmaydi yoki noaniq, va tanlov ro'yxati. */
export type PrepareResult = { ok: true; draft: Draft } | { ok: false; reply: Record<string, unknown> };

type Step<T> = { ok: true; value: T } | { ok: false; reply: Record<string, unknown> };
const ok = <T>(value: T): Step<T> => ({ ok: true, value });
const ask = (reply: Record<string, unknown>): { ok: false; reply: Record<string, unknown> } => ({ ok: false, reply });

/** "1 250 000 so'm" — kartadagi ko'rinish (mijoz `t()` bilan o'giradi). */
export function fmtSum(n: number): string {
  return `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} so'm`;
}

const norm = (s: string) => s.toLowerCase().replace(/[‘’ʻʼ`´]/g, "'").replace(/\s+/g, " ").trim();

/** Aniq nom, bo'lmasa YAGONA qisman moslik. Bir nechtasi mos kelsa — `null` (taxmin qilinmaydi). */
export function pickByName<T>(items: readonly T[], nameOf: (x: T) => string, wanted: string): T | null {
  const w = norm(wanted);
  if (!w) return null;
  const exact = items.filter((x) => norm(nameOf(x)) === w);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return null;
  const partial = items.filter((x) => norm(nameOf(x)).includes(w));
  return partial.length === 1 ? partial[0] : null;
}

// ── Oy ──────────────────────────────────────────────────────────────

function shiftMonth(key: string, d: number): string {
  const [y, m] = key.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + d, 1));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Ruxsat etilgan oylar — botdagi tugmalar bilan bir xil:
 *   kirim  — o'tgan · SHU · keyingi (oldindan to'lov bor);
 *   oylik  — o'tgan · SHU (kelajak oy uchun avans/oylik berilmaydi —
 *            yadro ham rad etadi, lib/cashboxAdjust.ts).
 * "Shu oy" — Toshkent vaqti bo'yicha `payrollPeriod`, yadro bilan bir xil.
 */
export function allowedMonths(kind: "kirim" | "payout"): { months: string[]; current: string } {
  const p = payrollPeriod();
  const current = payrollMonthKey(p);
  const prev = prevMonthKey(p);
  return { months: kind === "kirim" ? [prev, current, shiftMonth(current, 1)] : [prev, current], current };
}

function resolveMonth(input: string, kind: "kirim" | "payout"): Step<string> {
  const { months, current } = allowedMonths(kind);
  if (!input) return ok(current);
  if (!months.includes(input)) {
    return ask({ problem: `Month "${input}" is not allowed here.`, allowedMonths: months });
  }
  return ok(input);
}

// ── Summa ───────────────────────────────────────────────────────────

const MAX_AMOUNT = 10_000_000_000;

function requiredAmount(args: ToolArgs): Step<number> {
  const raw = args.amount;
  if (raw === undefined || raw === null || raw === "") {
    return ask({ problem: "Amount is missing. Ask the user for the exact amount in so'm; never guess it." });
  }
  const n = Number(typeof raw === "string" ? raw.replace(/[\s,]/g, "") : raw);
  if (!Number.isInteger(n) || n < 1 || n > MAX_AMOUNT) {
    throw new ToolInputError(`"amount" must be a whole number of so'm from 1 to ${MAX_AMOUNT}`);
  }
  return ok(n);
}

// ── O'quvchi va xodim ───────────────────────────────────────────────

export interface PupilPick {
  id: number;
  name: string;
  phone: string;
}

const CANDIDATES = 5;

/**
 * O'quvchi — `pupilId` (avvalgi qadamdagi nomzodlardan) yoki ism/telefon
 * bo'yicha qidiruv. Qamrov navbardagi filial (o'quvchilar hovuzi bilan) —
 * web'dagi Kirim oynasi va lid oynasi bilan bir xil. Bir nechta mos
 * kelsa — nomzodlar qaytadi, model xodimdan qaysi biri ekanini so'raydi.
 */
async function resolvePupil(ctx: AiContext, args: ToolArgs): Promise<Step<PupilPick>> {
  const projection = { _id: 0, id: 1, firstName: 1, lastName: 1, phone: 1 };
  const toPick = (r: Record<string, unknown>): PupilPick => ({
    id: Number(r.id),
    name: pupilFullName({ firstName: String(r.firstName ?? ""), lastName: String(r.lastName ?? "") }),
    phone: String(r.phone ?? ""),
  });

  const id = optInt(args, "pupilId", 1, 1_000_000_000);
  if (id !== null) {
    const r = await ctx.db.collection("pupils").findOne(withPupilBranch({ id }, ctx.scope), { projection });
    if (!r) return ask({ problem: "No student with this pupilId in the current branch. Search by name instead." });
    return ok(toPick(r));
  }

  const query = optString(args, "pupil", 100);
  if (!query) return ask({ problem: "Which student? Ask the user for the student's name (or phone)." });
  const filter = pupilSearchFilter(query);
  if (!filter) return ask({ problem: "The student search text is too short (at least 2 characters)." });
  const rows = await ctx.db
    .collection("pupils")
    .find(withPupilBranch(filter, ctx.scope), { projection })
    .limit(CANDIDATES + 1)
    .toArray();
  if (rows.length === 0) {
    return ask({ problem: `No student matches "${query}" in the current branch. Ask the user to check the name.` });
  }
  if (rows.length > 1) {
    return ask({
      problem: "Several students match. Ask the user which one (show names and masked phones), then call again with pupilId.",
      candidates: rows.slice(0, CANDIDATES).map((r) => {
        const p = toPick(r);
        return { pupilId: p.id, name: p.name, phone: maskPhone(p.phone) };
      }),
      more: rows.length > CANDIDATES || undefined,
    });
  }
  return ok(toPick(rows[0]));
}

interface EmployeePick {
  id: number;
  name: string;
  phone: string;
  role: string;
}

/** Xodim — faqat FAOLLAR (arxivdagiga oylik berilmaydi — Chiqim oynasi va bot bilan bir xil). */
async function resolveEmployee(ctx: AiContext, args: ToolArgs): Promise<Step<EmployeePick>> {
  const id = optInt(args, "employeeId", 1, 1_000_000_000);
  if (id !== null) {
    const r = await ctx.db.collection("hr_employees").findOne(
      { id, $or: [{ archReason: { $exists: false } }, { archReason: null }, { archReason: "" }] },
      { projection: { _id: 0, id: 1, name: 1, phone: 1, turi: 1 } },
    );
    if (!r) return ask({ problem: "No active employee with this employeeId. Search by name instead." });
    return ok({ id: Number(r.id), name: String(r.name ?? "").trim(), phone: String(r.phone ?? ""), role: String(r.turi ?? "") });
  }
  const query = optString(args, "employee", 100);
  if (!query) return ask({ problem: "Which employee? Ask the user for the employee's name." });
  const found = await searchEmployees(ctx.db, query);
  if (!found) return ask({ problem: "The employee search text is too short (at least 2 characters)." });
  if (found.hits.length === 0) return ask({ problem: `No active employee matches "${query}". Ask the user to check the name.` });
  if (found.hits.length > 1) {
    return ask({
      problem: "Several employees match. Ask the user which one, then call again with employeeId.",
      candidates: found.hits.slice(0, CANDIDATES).map((h) => ({ employeeId: h.id, name: h.name, role: h.turi, phone: maskPhone(h.phone) })),
      more: found.hits.length > CANDIDATES || found.more || undefined,
    });
  }
  const h = found.hits[0];
  return ok({ id: h.id, name: h.name, phone: h.phone, role: h.turi });
}

// ── Kassa va to'lov turi ────────────────────────────────────────────

/**
 * Xodimning kassasi — xodimlar boti bilan BIR XIL qoida
 * (lib/staffBot/auth.ts → findBotCashbox): admin — tanlagani yoki bosh
 * kassa; xodim — faqat o'zi mas'ul kassa (`moderator` = xodim ismi),
 * arxivlangani emas. Xodim boshqa kassa id'sini yozsa ham o'zinikidan
 * boshqasi berilmaydi.
 */
export async function resolveCashbox(ctx: AiContext, requested: number | null): Promise<Step<BotCashbox>> {
  if (requested !== null && !ctx.isAdmin) {
    const own = await findBotCashbox(ctx.db, { isAdmin: false, name: ctx.employeeName });
    if (!own || own.id !== requested) {
      return ask({ problem: "Employees can only use their own cashbox. Do not pass cashboxId." });
    }
    return ok(own);
  }
  const cashbox = await findBotCashbox(ctx.db, {
    isAdmin: ctx.isAdmin,
    name: ctx.employeeName,
    ...(requested !== null ? { cashboxId: requested } : {}),
  });
  if (!cashbox) {
    return ask({
      problem: ctx.isAdmin
        ? "There is no active primary cashbox."
        : "No cashbox is assigned to this user (the cashbox responsible person must be this employee). They cannot record cash operations.",
    });
  }
  if (requested !== null && cashbox.id !== requested) {
    const all = await listCashboxesForAdmin(ctx.db);
    return ask({
      problem: "That cashbox does not exist or is archived.",
      cashboxes: all.map((c) => ({ cashboxId: c.id, name: c.name, primary: c.isPrimary || undefined })),
    });
  }
  return ok(cashbox);
}

async function resolveMethod(ctx: AiContext, args: ToolArgs): Promise<Step<PaymentMethod>> {
  const methods = await loadActiveMethods(ctx.db);
  const names = methods.map((m) => m.name);
  const input = optString(args, "method", 60);
  if (!input) return ask({ problem: "Which payment method? Ask the user.", methods: names });
  const m = methods.find((x) => x.key === input) ?? pickByName(methods, (x) => x.name, input);
  if (!m) return ask({ problem: `Unknown payment method "${input}".`, methods: names });
  return ok(m);
}

function pickType(types: readonly TransactionType[], input: string, what: string): Step<TransactionType> {
  const names = types.map((t) => t.name);
  if (!input) return ask({ problem: `Which ${what} type? Ask the user if it is not obvious.`, types: names });
  const t = pickByName(types, (x) => x.name, input);
  if (!t) return ask({ problem: `Unknown ${what} type "${input}". Use one of the listed names.`, types: names });
  return ok(t);
}

/** Kirim turlari ichidan bot qo'llamaydigani — faqat xodimga bog'langan kirim (bunday tur bazada yo'q). */
export function usableKirimTypes(types: readonly TransactionType[]): TransactionType[] {
  return types.filter((t) => {
    const a = txAudience(t);
    return !(a.employee && !a.student && !a.unset && !a.thirdParty);
  });
}

// ── Dars kunlari ────────────────────────────────────────────────────

const DAY_WORDS: { re: RegExp; codes: string[] }[] = [
  { re: /^(toq|odd)/, codes: ["Du", "Ch", "Ju"] },
  { re: /^(juft|even)/, codes: ["Se", "Pa", "Sh"] },
  { re: /^(har|every|daily)/, codes: ["Du", "Se", "Ch", "Pa", "Ju", "Sh"] },
];

/** "toq" / "juft" / "har kuni" yoki aniq kunlar ("Du,Ch", "Dushanba, Juma"). */
export function lessonDayCodes(input: string): string[] {
  const t = norm(input);
  if (!t) return [];
  const word = DAY_WORDS.find((w) => w.re.test(t));
  if (word) return [...word.codes];
  return parseLessonDays(input);
}

// ── Qoralamalar ─────────────────────────────────────────────────────

export async function prepareLead(ctx: AiContext, args: ToolArgs): Promise<PrepareResult> {
  const pupil = await resolvePupil(ctx, args);
  if (!pupil.ok) return pupil;

  const courses = await loadCourseNames(ctx.db);
  if (courses.length === 0) return ask({ problem: "No courses are configured (Settings → Courses), so a lead cannot be added." });
  const courseIn = optString(args, "course", 100);
  if (!courseIn) return ask({ problem: "Which course? Ask the user.", courses });
  const course = pickByName(courses, (c) => c, courseIn);
  if (!course) return ask({ problem: `Unknown course "${courseIn}". Use one of the listed names.`, courses });

  const codes = lessonDayCodes(optString(args, "days", 80));
  if (codes.length === 0) {
    return ask({
      problem: "Which lesson days? Ask the user.",
      dayOptions: ["toq (Du, Ch, Ju)", "juft (Se, Pa, Sh)", "har kuni (Du–Sh)", "or specific days: Du, Se, Ch, Pa, Ju, Sh, Ya"],
    });
  }
  const note = optString(args, "note", 500);
  const author = authorNameOf(ctx);
  const p = pupil.value;

  return {
    ok: true,
    draft: {
      kind: "lead",
      payload: {
        studentName: p.name,
        phone: p.phone,
        course,
        lessonDay: formatLessonDays(codes),
        note,
        branchId: ctx.scope.branchId,
        authorName: author,
      },
      fields: [
        { key: "pupil", value: p.phone ? `${p.name} · ${formatPhone(p.phone)}` : p.name },
        { key: "course", value: course },
        { key: "days", value: lessonDaysLabel(codes) },
        { key: "branch", value: ctx.branchName },
        { key: "author", value: author || "—" },
        ...(note ? [{ key: "note" as const, value: note }] : []),
      ],
      forModel: {
        action: "add lead",
        student: p.name,
        phone: maskPhone(p.phone),
        course,
        days: lessonDaysLabel(codes),
        branch: ctx.branchName,
        note: note || undefined,
      },
    },
  };
}

export async function prepareKirim(ctx: AiContext, args: ToolArgs): Promise<PrepareResult> {
  const cashbox = await resolveCashbox(ctx, optInt(args, "cashboxId", 1, 1_000_000_000));
  if (!cashbox.ok) return cashbox;

  const types = usableKirimTypes(await loadKirimTypes(ctx.db));
  const type = pickType(types, optString(args, "type", 100), "income");
  if (!type.ok) return type;
  // Kim to'laydi — Sozlamalardagi "Mijoz" katakchalaridan (lib/txTarget.ts),
  // Kirim oynasi va bot bilan bir xil: uchinchi shaxsda odam ham, oy ham yo'q.
  const a = txAudience(type.value);
  const needsStudent = !a.thirdParty && (a.student || a.unset);
  const needsMonth = !a.thirdParty;

  let pupil: PupilPick | null = null;
  let group = { groupLabel: "", teacher: "" };
  if (needsStudent) {
    const r = await resolvePupil(ctx, args);
    if (!r.ok) return r;
    pupil = r.value;
    // Ustoz ID bo'yicha topilgan guruhdan — yadro ism bo'yicha qidirsa ismdoshlar aralashardi (bot bilan bir xil).
    group = await pupilGroupInfo(ctx.db, pupil.id);
  }

  const amount = requiredAmount(args);
  if (!amount.ok) return amount;
  const method = await resolveMethod(ctx, args);
  if (!method.ok) return method;

  let periodMonth: string | undefined;
  if (needsMonth) {
    const m = resolveMonth(optMonth(args, "month"), "kirim");
    if (!m.ok) return m;
    periodMonth = m.value;
  }

  const note = optString(args, "note", 500);
  // Izohdagi oy ≠ «Qaysi oy uchun» — MAJBURIY qoida (lib/noteMonth.ts), yadro ham rad etadi.
  if (periodMonth && group.teacher && noteMonthConflict(note, periodMonth)) {
    return ask({ problem: `The note mentions a different month than the payment month (${periodMonth}). Ask the user to fix the note or the month.` });
  }

  // Tanga evaziga chegirma — faqat ko'rsatish uchun; qo'llashni yadro hal qiladi (bot bilan bir xil).
  let discount = "";
  if (pupil && periodMonth) {
    const pd = await pendingDiscountFor(ctx.db, pupil.id, periodMonth).catch(() => null);
    const want = pd?.teacherName.trim().toLowerCase() ?? "";
    const teacher = group.teacher.trim().toLowerCase();
    if (pd && pd.inGroup && (!want || !teacher || teacher === want)) discount = `${fmtSum(pd.amountSom)} (${pd.percent}%)`;
  }

  const cb = cashbox.value;
  return {
    ok: true,
    draft: {
      kind: "kirim",
      payload: {
        cashboxId: cb.id,
        method: method.value.key,
        amount: amount.value,
        category: type.value.name,
        teacherName: group.teacher,
        studentName: pupil?.name ?? "",
        ...(pupil ? { studentId: pupil.id } : {}),
        ...(periodMonth ? { periodMonth } : {}),
        note,
      },
      fields: [
        { key: "type", value: type.value.name },
        ...(pupil ? [{ key: "pupil" as const, value: pupil.phone ? `${pupil.name} · ${formatPhone(pupil.phone)}` : pupil.name }] : []),
        ...(group.groupLabel ? [{ key: "group" as const, value: group.groupLabel }] : []),
        ...(pupil ? [{ key: "teacher" as const, value: group.teacher || "—" }] : []),
        { key: "amount", value: fmtSum(amount.value) },
        { key: "method", value: method.value.name },
        ...(periodMonth ? [{ key: "month" as const, value: periodMonth }] : []),
        ...(discount ? [{ key: "discount" as const, value: discount }] : []),
        { key: "cashbox", value: cb.name },
        ...(note ? [{ key: "note" as const, value: note }] : []),
      ],
      forModel: {
        action: "income (kirim)",
        type: type.value.name,
        student: pupil?.name,
        group: group.groupLabel || undefined,
        teacher: group.teacher || undefined,
        amount: amount.value,
        method: method.value.name,
        month: periodMonth,
        coinDiscount: discount || undefined,
        cashbox: cb.name,
        note: note || undefined,
      },
    },
  };
}

export async function prepareChiqim(ctx: AiContext, args: ToolArgs): Promise<PrepareResult> {
  const cashbox = await resolveCashbox(ctx, optInt(args, "cashboxId", 1, 1_000_000_000));
  if (!cashbox.ok) return cashbox;
  const cb = cashbox.value;

  const type = pickType(await loadChiqimTypes(ctx.db), optString(args, "type", 100), "expense");
  if (!type.ok) return type;
  // KIM oladi — turning "Mijoz" sozlamasidan; ikkalasi belgilangan bo'lsa xodim ustun (lib/txTarget.ts).
  const target = txTarget(type.value);
  const salaryPayout = target === "employee" && isEmployeePayoutCategory(type.value.name);
  // "Oylik" turida summa qo'lda yozilmaydi — xodimning qoldig'ining o'zi (bot va Chiqim oynasi qoidasi, 18.09.2026).
  const oylikLocked = salaryPayout && /oylik/i.test(type.value.name);

  let employee: EmployeePick | null = null;
  let pupil: PupilPick | null = null;
  let refundTeacher = "";
  let studentBalance: number | null = null;
  if (target === "employee") {
    const r = await resolveEmployee(ctx, args);
    if (!r.ok) return r;
    employee = r.value;
  } else if (target === "student") {
    const r = await resolvePupil(ctx, args);
    if (!r.ok) return r;
    pupil = r.value;
    const ref = { id: pupil.id, name: pupil.name };
    // Qaytarish chegarasi — faqat NAQD to'langani (tanga chegirmasi naqd qaytarilmaydi; bot bilan bir xil).
    [studentBalance, refundTeacher] = await Promise.all([
      studentPaidBalance(ctx.db, ref, { cashOnly: true }),
      refundTeacherOf(ctx.db, ref).then((t) => t ?? ""),
    ]);
  }

  const method = await resolveMethod(ctx, args);
  if (!method.ok) return method;

  let periodMonth: string | undefined;
  let limit: number | null = null;
  if (salaryPayout && employee) {
    const m = resolveMonth(optMonth(args, "month"), "payout");
    if (!m.ok) return m;
    periodMonth = m.value;
    // Chegara TANLANGAN oy qatoridan — yadro ham aynan shu qatorni tekshiradi.
    const salary = await employeeSalaryInfo(ctx.db, employee.name, periodMonth);
    if (salary?.configured) {
      const isPlastik = method.value.key === PLASTIK_METHOD_KEY;
      limit = isPlastik ? salary.jami : salary.naqd;
      if (limit <= 0) {
        const cardOnly = !isPlastik && salary.naqd <= 0 && salary.plastikSalary > 0 && salary.jami > 0;
        return ask({
          problem: cardOnly
            ? `The salary for ${periodMonth} does not exceed the card part; nothing can be paid in cash (${salary.karta} so'm goes to the card).`
            : `Nothing can be paid to this employee for ${periodMonth}: the salary is fully paid or not calculated yet.`,
        });
      }
    }
  } else if (target === "student") {
    limit = Math.max(0, studentBalance ?? 0);
    if (limit <= 0) return ask({ problem: "This student has no paid balance to refund." });
  }

  let amount: number;
  let amountNote: string | undefined;
  if (oylikLocked && limit !== null) {
    amount = limit;
    amountNote = `For "${type.value.name}" the amount is always the employee's remaining salary for the month: ${amount} so'm.`;
  } else {
    const a = requiredAmount(args);
    if (!a.ok) return a;
    amount = a.value;
    if (limit !== null && amount > limit) {
      return ask({ problem: `The amount is more than allowed: at most ${limit} so'm.`, limit });
    }
  }

  // Kassada shu to'lov turidan yetarli pul bormi (yadro ham tekshiradi).
  const available = cb.methodTotals[method.value.key] ?? 0;
  if (amount > available) {
    return ask({ problem: `Not enough money in the cashbox for this payment method (available: ${available} so'm).`, available });
  }

  const note = optString(args, "note", 500);
  if (salaryPayout && periodMonth && noteMonthConflict(note, periodMonth)) {
    return ask({ problem: `The note mentions a different month than the salary month (${periodMonth}). Ask the user to fix the note or the month.` });
  }

  const personName = employee?.name ?? pupil?.name ?? "";
  return {
    ok: true,
    draft: {
      kind: "chiqim",
      payload: {
        cashboxId: cb.id,
        method: method.value.key,
        amount,
        category: type.value.name,
        // Jurnaldagi "KIM" — xodim ham, o'quvchi ham `studentName` da (Chiqim oynasi va bot kelishuvi).
        studentName: personName,
        ...(pupil ? { studentId: pupil.id } : {}),
        teacherName: employee ? employee.name : pupil ? refundTeacher : "",
        ...(salaryPayout && periodMonth ? { periodMonth } : {}),
        note,
      },
      fields: [
        { key: "type", value: type.value.name },
        ...(employee ? [{ key: "employee" as const, value: employee.name }] : []),
        ...(pupil ? [{ key: "pupil" as const, value: pupil.phone ? `${pupil.name} · ${formatPhone(pupil.phone)}` : pupil.name }] : []),
        ...(salaryPayout && periodMonth ? [{ key: "month" as const, value: periodMonth }] : []),
        { key: "amount", value: fmtSum(amount) },
        { key: "method", value: method.value.name },
        { key: "cashbox", value: cb.name },
        ...(note ? [{ key: "note" as const, value: note }] : []),
      ],
      forModel: {
        action: "expense (chiqim)",
        type: type.value.name,
        employee: employee?.name,
        student: pupil?.name,
        month: salaryPayout ? periodMonth : undefined,
        amount,
        amountNote,
        method: method.value.name,
        cashbox: cb.name,
        note: note || undefined,
      },
    },
  };
}
