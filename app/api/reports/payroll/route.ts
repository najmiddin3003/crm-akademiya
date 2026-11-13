import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";
import { getBranchScope } from "@/lib/branchScope";
import { isPathAllowed } from "@/lib/permissions";
import { buildPayrollReport, lastClosedMonth, loadPayrollMinMonth, monthKeysBetween } from "@/lib/reportPayroll";
import { ISO_MONTH } from "@/lib/reportScope";

// GET /api/reports/payroll — Hisobotlar → Xodimlar va oylik → «Oylik va avans» (26-qism).
//   ?from=YYYY-MM&to=YYYY-MM   — YOPILGAN oylar (sukut — oxirgi yopilgan oy); joriy oy
//                                kirmaydi (u Moliya → Oylik chiqarishda). Chegaradan
//                                tashqarisi qisiladi: [minMonth, maxMonth].
//   ?branch=all|<id>           — xodimning OYLIK filiali (bino), Oylik chiqarish kabi.
// Hisob — lib/reportPayroll.ts (Oylik chiqarish sahifasining o'zi: buildPayrollRows).
//
// RUXSAT HANDLER ICHIDA: hisobotlar sahifasi (/reports) hammaga ochiq va generator
// (scripts/gen-api-permissions.mjs) bu route'ni «sessiya yetarli» darajasiga qo'yadi —
// xodimlar oyligi esa faqat «Oylik chiqarish» ruxsati borlarga (lib/reportsCatalog.ts →
// oylik-avans.perms). Qolgan v2 hisobot route'lari bilan bir xil javob shakli.

const PERM = "/finance-payroll";
/** Bir so'rovda ko'pi bilan shuncha oy — har oy uchun alohida oylik hisobi quriladi. */
const MAX_MONTHS = 24;

export async function GET(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
  if (!isPathAllowed(PERM, me.permissions)) {
    return NextResponse.json({ ok: false, error: "Bu hisobotga ruxsatingiz yo'q" }, { status: 403 });
  }
  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });

  const sp = new URL(req.url).searchParams;
  const rawFrom = (sp.get("from") ?? "").trim();
  const rawTo = (sp.get("to") ?? "").trim();
  if ((rawFrom && !ISO_MONTH.test(rawFrom)) || (rawTo && !ISO_MONTH.test(rawTo))) {
    return NextResponse.json({ ok: false, error: "Oy noto'g'ri (YYYY-MM kutiladi)" }, { status: 400 });
  }

  // FILIAL: «Barchasi» — xodimga ruxsat etilgan filiallar (admin — hammasi, oylik filiali
  // yo'q xodim ham); bitta — faqat o'sha bino (hovuz ochilmaydi: oylik bino bo'yicha).
  const rawBranch = (sp.get("branch") ?? "").trim();
  let branch: "all" | number = "all";
  if (rawBranch && rawBranch !== "all") {
    const n = Number(rawBranch);
    if (!Number.isInteger(n) || n <= 0 || (!scope.isAdmin && !scope.allowed.includes(n))) {
      return NextResponse.json({ ok: false, error: "Bu filial sizga biriktirilmagan" }, { status: 403 });
    }
    branch = n;
  }
  const branchIds = branch === "all" ? (scope.isAdmin ? null : [...scope.allowed]) : [branch];

  const db = await ensureIndexes();
  const maxMonth = lastClosedMonth();
  const minMonth = (await loadPayrollMinMonth(db)) ?? maxMonth;
  const from = rawFrom || rawTo || maxMonth;
  const to = rawTo || rawFrom || maxMonth;
  if (from > to) return NextResponse.json({ ok: false, error: "Oy oralig'i noto'g'ri" }, { status: 400 });
  // Qisish: oylik hisobi boshlanmagan oylar va joriy/kelajak oy hisobotga kirmaydi.
  const months = monthKeysBetween(from < minMonth ? minMonth : from, to > maxMonth ? maxMonth : to);
  if (months.length > MAX_MONTHS) {
    return NextResponse.json({ ok: false, error: "Ko'pi bilan 24 oy tanlang" }, { status: 400 });
  }

  const [report, branches] = await Promise.all([
    buildPayrollReport(db, { months, branchIds, cashboxBranchIds: branchIds }),
    db
      .collection("branches")
      .find(scope.isAdmin ? {} : { id: { $in: scope.allowed } }, { projection: { _id: 0, id: 1, name: 1 } })
      .sort({ id: 1 })
      .toArray(),
  ]);

  return NextResponse.json({
    ok: true,
    branch,
    from,
    to,
    minMonth,
    maxMonth,
    closedThrough: report.closedThrough,
    branches: branches.map((b) => ({ id: Number(b.id), name: String(b.name ?? "") })),
    months: report.months,
  });
}
