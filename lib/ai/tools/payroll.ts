import { attachBranchPayouts, attachMaybePaidIn, buildPayrollRows } from "@/lib/payrollSources";
import {
  payrollDebt,
  payrollDue,
  payrollEarned,
  payrollMonthKey,
  payrollOwedTotal,
  payrollPayout,
  payrollPeriod,
  payrollPeriodOf,
  payrollTax,
  salaryTypeTag,
  type EmployeePayroll,
  type PayrollPeriod,
} from "@/lib/salary";
import { payrollBuilding } from "@/lib/branchScope";
import { branchBuildingLabel, branchPool, buildingNo, sameBranchPool } from "@/lib/branchPools";
import type { AiContext } from "../context";
import { optInt, optMonth, optString, ToolInputError, type AiTool, type ToolArgs } from "./types";

// OYLIK — "Oylik chiqarish" sahifasi bilan bir xil hisob.
//
// Ro'yxat `payrollBranchId` bo'yicha (app/api/salary-runs/employees-payroll
// dagi kabi): ikki filialda ishlaydigan xodim faqat BITTA filialning
// ro'yxatida turadi. Formulalar lib/salary.ts dan — o'zimiz hisoblamaymiz,
// aks holda AI aytgan "qolgan" sahifadagidan farq qilib qolardi.
//
// ZANJIR HAM SAHIFANIKI (09.10.2026): qatorlar → o'tgan oyda «qayta
// chiqarmang» belgisi (attachMaybePaidIn) → «Berilgan avans» / «To'langan
// oylik» kartochkalari KASSA filiali bo'yicha (attachBranchPayouts). Jami
// «Qolgan to'lanadigan» faqat musbat qoldiqlardan (payrollPayout),
// qarzdorlik alohida (payrollDebt) — ishorali yig'indida bir xodimning
// qarzi boshqasiga to'lanadigan pulni "yeb" qo'yardi (SalaryCreatePage).
//
// 11.10.2026 — 10.10 suhbatlaridagi xatolar tuzatildi:
//   • «barcha filiallar» — `allBranches`: xodim ocha oladigan HAR oylik
//     ro'yxati (bino) alohida va umumiy jami. Ilgari model faqat navbar
//     filialini ko'rib, qolganini «hisoblab bo'lmaydi» derdi;
//   • oylik JONLI hisoblanadi — `salary_runs` faqat chiqarilgan pul. Model
//     «oktabr oyligi hali shakllantirilmagan» deb `salary_runs` ga qarab
//     xato xulosa qilgan edi — tavsifda aniq aytildi;
//   • avans — `advance` (shu OY UCHUN berilgani, sahifadagidek), oylik
//     to'lovi — `salaryPaid`, alohida. Model avansni to'lov SANASI bo'yicha
//     yig'ib, sentabr pullarini oktabrga qo'shib yuborgan edi;
//   • `position` — «ustozlar» = teacher.
//
// Bu — eng nozik ma'lumot (xodimlar maoshi), shuning uchun faqat
// `/finance-payroll` ruxsati bor xodimga ochiq.

/** Bitta ro'yxatda (bitta filial) ko'rsatiladigan xodimlar. */
const LIMIT = 40;
/** «Barcha filiallar» da jami ko'rsatiladigan xodimlar (natija 20 000 belgidan oshmasin). */
const LIMIT_ALL = 70;

type Totals = { earned: number; advance: number; salaryPaid: number; toPay: number; debt: number };

function totalsOf(rows: EmployeePayroll[], p: PayrollPeriod): Totals {
  const t: Totals = { earned: 0, advance: 0, salaryPaid: 0, toPay: 0, debt: 0 };
  for (const e of rows) {
    if (!e.configured) continue;
    t.earned += payrollEarned(e, p);
    t.advance += e.paidAvans;
    t.salaryPaid += e.paidOylik;
    t.toPay += payrollPayout(e, p);
    t.debt += payrollDebt(e, p);
  }
  return t;
}

function addTotals(a: Totals, b: Totals): Totals {
  return {
    earned: a.earned + b.earned,
    advance: a.advance + b.advance,
    salaryPaid: a.salaryPaid + b.salaryPaid,
    toPay: a.toPay + b.toPay,
    debt: a.debt + b.debt,
  };
}

/** Xodim qatori — modelga (nol va bo'sh maydonlar tashlab yuboriladi). */
function employeeRow(e: EmployeePayroll, p: PayrollPeriod, branch?: string) {
  if (!e.configured) return { name: e.name, ...(branch ? { branch } : {}), position: e.turi || undefined, salary: "not configured" };
  return {
    name: e.name,
    ...(branch ? { branch } : {}),
    position: e.turi || undefined,
    salaryType: salaryTypeTag(e),
    earned: payrollEarned(e, p),
    tax: payrollTax(e, p) || undefined,
    advance: e.paidAvans || undefined,
    salaryPaid: e.paidOylik || undefined,
    remaining: payrollDue(e, p),
    toPay: payrollPayout(e, p) || undefined,
    debt: payrollDebt(e, p) || undefined,
    // O'tgan oylarda to'lanmagan qism ham qo'shilgan jami — faqat ma'lumot.
    owedIncludingPastMonths: payrollOwedTotal(e, p),
    // O'tgan oy ochilganda: shu qoldiq joriy oyda o'sha oy yozuvi bo'lib berilgan bo'lishi mumkin.
    ...(e.maybePaidIn
      ? {
          possiblyAlreadyPaid: {
            month: e.maybePaidIn.month,
            amount: e.maybePaidIn.amount,
            warning: "may already be paid as a record of that month — do not pay it again before checking",
          },
        }
      : {}),
  };
}

/** Lavozim filtri: "teacher" | "moderator" | … (bo'sh — hammasi). */
function positionFilter(args: ToolArgs): (e: EmployeePayroll) => boolean {
  const pos = optString(args, "position", 20).toLowerCase();
  return pos ? (e) => String(e.turi ?? "").toLowerCase() === pos : () => true;
}

/** Xodim ocha oladigan oylik ro'yxatlari (filial / bino) — admin hammasini. */
function payrollListsFor(ctx: AiContext): number[] {
  return [...ctx.scope.allowed].sort((a, b) => a - b);
}

function listLabel(ctx: AiContext, id: number): string {
  const name = (ctx.branches ?? []).find((b) => sameBranchPool(b.id, id))?.name ?? `#${id}`;
  return branchBuildingLabel({ id, name }, (n) => `building ${n}`);
}

export const payrollSummary: AiTool = {
  name: "payroll_summary",
  description:
    "Employee salaries (oylik) for a month, the same calculation as the 'Oylik chiqarish' page. The payroll is calculated LIVE " +
    "from the data at any moment — it does NOT need to be 'formed' first; salary_runs only stores payouts already made, so an " +
    "empty month there never means the payroll is unknown. Per employee: earned, tax, advance (advances given FOR this month, " +
    "counted by the salary month exactly as on the page — not by payment date), salaryPaid, remaining, toPay (positive " +
    "remainders only) and debt (paid above the earned amount) — never net toPay and debt against each other. " +
    "Payroll lists are kept per branch (per building in Akademiya Chortoq). allBranches=true covers every list the user may " +
    "see, with per-branch subtotals and grand totals — use it for 'barcha filiallar' / 'hamma xodimlar' and, for an " +
    "administrator, whenever no branch is named. position='teacher' for teachers (ustozlar). For a past month, a row with " +
    "possiblyAlreadyPaid must NOT be paid again before the user checks that record.",
  parameters: {
    type: "object",
    properties: {
      month: { type: "string", description: "Month YYYY-MM. Default: current month." },
      employee: { type: "string", description: "Optional: part of the employee name." },
      position: {
        type: "string",
        description: "Optional: only this position — teacher (ustoz, o'qituvchi), moderator, … ",
      },
      allBranches: {
        type: "boolean",
        description: "Every payroll list the user may see (all branches and buildings), with per-branch subtotals and grand totals.",
      },
      building: {
        type: "integer",
        description:
          "Only for a branch with several buildings (Akademiya Chortoq: 1 and 2) and allBranches false — payroll is kept per " +
          "building. Default: the user's current building; the answer lists otherBuildings.",
      },
    },
    additionalProperties: false,
  },
  pages: ["/finance-payroll"],
  async run(ctx, args) {
    const month = optMonth(args, "month");
    const who = optString(args, "employee", 60).toLowerCase();
    const p = month ? payrollPeriodOf(month) : payrollPeriod();
    const monthKey = payrollMonthKey(p);
    const byPosition = positionFilter(args);
    const pick = (rows: EmployeePayroll[]) =>
      rows.filter((e) => byPosition(e) && (!who || String(e.name ?? "").toLowerCase().includes(who)));
    const rule =
      "remaining = earned − tax + carry-over − paid. toPay sums only positive remainders (what the cashboxes still have to pay out); " +
      "debt sums what employees received above their pay. advance and salaryPaid count money given FOR this month.";

    // ── BARCHA FILIALLAR ──
    if (args.allBranches === true) {
      const lists = payrollListsFor(ctx);
      const parts = await Promise.all(
        lists.map(async (id) => ({ id, rows: pick(await attachMaybePaidIn(ctx.db, p, await buildPayrollRows(ctx.db, p, { payrollBranchId: id }))) })),
      );
      let grand: Totals = { earned: 0, advance: 0, salaryPaid: 0, toPay: 0, debt: 0 };
      const branches = parts.map(({ id, rows }) => {
        const t = totalsOf(rows, p);
        grand = addTotals(grand, t);
        return { branch: listLabel(ctx, id), employees: rows.length, notConfigured: rows.filter((e) => !e.configured).length || undefined, totals: t };
      });
      const all = parts.flatMap(({ id, rows }) => rows.map((e) => ({ e, branch: listLabel(ctx, id) })));
      return {
        scope: "all payroll lists the user may see (payroll is kept per branch / building)",
        month: monthKey,
        rule,
        totals: grand,
        branches,
        employeesTotal: all.length,
        employees: all.slice(0, LIMIT_ALL).map(({ e, branch }) => employeeRow(e, p, branch)),
        ...(all.length > LIMIT_ALL ? { more: all.length - LIMIT_ALL, hint: "narrow with position or employee" } : {}),
        page: "/finance-payroll",
      };
    }

    // ── BITTA RO'YXAT (navbar filiali / bino) ──
    // BINO (10.10.2026): 1+2 «Akademiya Chortoq» — oylik bino bo'yicha
    // (lib/branchScope.ts → payrollBuilding), Oylik sahifasidagi almashtirgich kabi.
    // `building` — bino RAQAMI (1, 2 …), hovuzdagi o'rni; filial id'siga aylantiriladi.
    const bn = optInt(args, "building", 1, 9);
    const wanted = bn === null ? undefined : branchPool(ctx.scope.branchId)[bn - 1];
    if (bn !== null && wanted === undefined) throw new ToolInputError("This branch has no such building");
    const building = payrollBuilding(ctx.scope, wanted);
    if (building === null) throw new ToolInputError("This building is not available to the user");
    const otherBuildings = branchPool(building).filter(
      (b) => b !== building && (ctx.scope.isAdmin || ctx.scope.allowed.includes(b)),
    );

    // GET /api/salary-runs/employees-payroll?given=1 bilan bir xil tartib.
    const built = await buildPayrollRows(ctx.db, p, { payrollBranchId: building });
    const flagged = await attachMaybePaidIn(ctx.db, p, built);
    const { rows, given } = await attachBranchPayouts(ctx.db, monthKey, building, flagged);
    const hit = pick(rows);
    const filtered = Boolean(who) || hit.length !== rows.length;

    return {
      branch: ctx.branchName,
      ...(buildingNo(building) !== null
        ? { building: buildingNo(building), otherBuildings: otherBuildings.map((b) => buildingNo(b)) }
        : {}),
      month: monthKey,
      rule,
      employeesTotal: hit.length,
      notConfigured: hit.filter((e) => !e.configured).length,
      totals: totalsOf(hit, p),
      // Sahifadagi «Berilgan avans» / «To'langan oylik» — pul qaysi filial kassasidan chiqqani bo'yicha.
      ...(filtered
        ? {}
        : {
            cashboxPayouts: given.hasCashbox
              ? {
                  advance: given.avans,
                  salary: given.oylik,
                  toEmployeesOfOtherBranches: {
                    advance: given.toOthers.reduce((s, o) => s + o.avans, 0),
                    salary: given.toOthers.reduce((s, o) => s + o.oylik, 0),
                  },
                  fromOtherBranchesCashboxes: given.fromOthers,
                }
              : "no cashbox is assigned to this branch",
          }),
      employees: hit.slice(0, LIMIT).map((e) => employeeRow(e, p)),
      ...(hit.length > LIMIT ? { more: hit.length - LIMIT } : {}),
      ...(ctx.scope.allowed.length > 1 ? { otherLists: "allBranches=true covers every branch the user may see" } : {}),
      page: "/finance-payroll",
    };
  },
};
