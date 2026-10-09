import { attachBranchPayouts, attachMaybePaidIn, buildPayrollRows } from "@/lib/payrollSources";
import {
  payrollDebt,
  payrollDue,
  payrollEarned,
  payrollMonthKey,
  payrollOwedTotal,
  payrollPaid,
  payrollPayout,
  payrollPeriod,
  payrollPeriodOf,
  payrollTax,
  salaryTypeTag,
} from "@/lib/salary";
import { optMonth, optString, type AiTool } from "./types";

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
// Bu — eng nozik ma'lumot (xodimlar maoshi), shuning uchun faqat
// `/finance-payroll` ruxsati bor xodimga ochiq.

const LIMIT = 40;

export const payrollSummary: AiTool = {
  name: "payroll_summary",
  description:
    "Employee salaries (oylik) for a month in the current branch, the same calculation as the 'Oylik chiqarish' page: " +
    "earned, tax, already paid (advance + salary), still to pay (toPay, positive remainders only) and employee debts " +
    "(debt, paid above the earned amount) — kept separate as on the page. cashboxPayouts are the page cards: advances and " +
    "salaries paid from THIS branch's cashboxes. For a past month, a row with possiblyAlreadyPaid must NOT be paid again " +
    "before the user checks that record. Optional filter by employee name.",
  parameters: {
    type: "object",
    properties: {
      month: { type: "string", description: "Month YYYY-MM. Default: current month." },
      employee: { type: "string", description: "Optional: part of the employee name." },
    },
    additionalProperties: false,
  },
  pages: ["/finance-payroll"],
  async run(ctx, args) {
    const month = optMonth(args, "month");
    const who = optString(args, "employee", 60).toLowerCase();
    const p = month ? payrollPeriodOf(month) : payrollPeriod();
    const monthKey = payrollMonthKey(p);

    // GET /api/salary-runs/employees-payroll?given=1 bilan bir xil tartib.
    const built = await buildPayrollRows(ctx.db, p, { payrollBranchId: ctx.scope.branchId });
    const flagged = await attachMaybePaidIn(ctx.db, p, built);
    const { rows, given } = await attachBranchPayouts(ctx.db, monthKey, ctx.scope.branchId, flagged);
    const hit = who ? rows.filter((e) => String(e.name ?? "").toLowerCase().includes(who)) : rows;
    const configured = hit.filter((e) => e.configured);
    const sum = (f: (e: (typeof configured)[number]) => number) => configured.reduce((s, e) => s + f(e), 0);

    return {
      branch: ctx.branchName,
      month: monthKey,
      rule:
        "remaining = earned − tax + carry-over − paid. toPay sums only positive remainders (what the cashbox still has to pay out); " +
        "debt sums what employees received above their pay. Never net them against each other.",
      employeesTotal: hit.length,
      notConfigured: hit.length - configured.length,
      totals: {
        earned: sum((e) => payrollEarned(e, p)),
        paidPerEmployeeRows: sum((e) => payrollPaid(e)),
        toPay: sum((e) => payrollPayout(e, p)),
        debt: sum((e) => payrollDebt(e, p)),
      },
      // Sahifadagi «Berilgan avans» / «To'langan oylik» — pul qaysi filial kassasidan chiqqani bo'yicha.
      ...(who
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
      employees: hit.slice(0, LIMIT).map((e) =>
        e.configured
          ? {
              name: e.name,
              position: e.turi || undefined,
              salaryType: salaryTypeTag(e),
              earned: payrollEarned(e, p),
              tax: payrollTax(e, p) || undefined,
              paid: payrollPaid(e),
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
            }
          : { name: e.name, position: e.turi || undefined, salary: "not configured" },
      ),
      page: "/finance-payroll",
    };
  },
};
