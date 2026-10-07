import { buildPayrollRows } from "@/lib/payrollSources";
import {
  payrollDue,
  payrollEarned,
  payrollMonthKey,
  payrollOwedTotal,
  payrollPaid,
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
// Bu — eng nozik ma'lumot (xodimlar maoshi), shuning uchun faqat
// `/finance-payroll` ruxsati bor xodimga ochiq.

const LIMIT = 40;

export const payrollSummary: AiTool = {
  name: "payroll_summary",
  description:
    "Employee salaries (oylik) for a month in the current branch, the same calculation as the 'Oylik chiqarish' page: " +
    "earned, tax, already paid (advance + salary) and remaining to pay. Optional filter by employee name.",
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

    const rows = await buildPayrollRows(ctx.db, p, { payrollBranchId: ctx.scope.branchId });
    const hit = who ? rows.filter((e) => String(e.name ?? "").toLowerCase().includes(who)) : rows;
    const configured = hit.filter((e) => e.configured);

    return {
      branch: ctx.branchName,
      month: payrollMonthKey(p),
      rule: "remaining = earned − tax + carry-over − paid; negative remaining means the employee received more than earned",
      employeesTotal: hit.length,
      notConfigured: hit.length - configured.length,
      totals: {
        earned: configured.reduce((s, e) => s + payrollEarned(e, p), 0),
        paid: configured.reduce((s, e) => s + payrollPaid(e), 0),
        remaining: configured.reduce((s, e) => s + payrollDue(e, p), 0),
      },
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
              // O'tgan oylarda to'lanmagan qism ham qo'shilgan jami — faqat ma'lumot.
              owedIncludingPastMonths: payrollOwedTotal(e, p),
            }
          : { name: e.name, position: e.turi || undefined, salary: "not configured" },
      ),
      page: "/finance-payroll",
    };
  },
};
