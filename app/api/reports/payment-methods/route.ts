import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ensureIndexes } from "@/lib/mongodb";
import { buildMethodUsage, isoDaysBefore, USAGE_DAYS } from "@/lib/paymentMethodUsage";
import { loadUsageRows } from "@/lib/reportPaymentMethods";
import { canOpenReport, REPORT_BY_SLUG } from "@/lib/reportsCatalog";
import { uzDateIso } from "@/lib/uzTime";

// GET /api/reports/payment-methods — Hisobotlar → «To'lov turlari» (26-qism, 13.11.2026).
//
//   cashboxes — { id, name, archived, isPrimary, branchId, owner } (owner — `moderator`,
//               «Kassalar bo'yicha» jadvalida nom ostida). PUL YO'Q: balans ham, summa ham.
//   usage     — har tur oxirgi USAGE_DAYS kunda qaysi kassalarga tushum sifatida yozilgani
//               ({ [key]: [{ cashboxId, count }] }), GET /api/payment-methods bilan bir xil.
//               Jadvaldagi «–» (kassa bu turni qabul qilmaydi) va kartadagi «N kassada» shundan.
//
// NEGA ALOHIDA: /api/cashboxes?names=1 da mas'ul yo'q, to'liq /api/cashboxes esa xodimga
// faqat o'z kassasini (balans bilan) beradi; /api/payment-methods — /settings-finance.
//
// RUXSAT shu yerda — hisobot sahifasi bilan bir xil (lib/reportsCatalog.ts, `canOpenReport`):
// «To'lov turlari» ruxsatlari (/finance-cashflow). Route ReportView'ning nisbiy importlari
// orqali ishlatiladi — generator (scripts/gen-api-permissions.mjs) uni sahifaga bog'lamaydi.
export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
  const report = REPORT_BY_SLUG["tolov-turlari"];
  if (!report || !canOpenReport(report, me.permissions)) {
    return NextResponse.json({ ok: false, error: "Bu bo'limga ruxsatingiz yo'q" }, { status: 403 });
  }

  const db = await ensureIndexes();
  const since = isoDaysBefore(uzDateIso(), USAGE_DAYS);
  const [cashboxes, usageRows] = await Promise.all([
    db
      .collection("cashboxes")
      .find({}, { projection: { _id: 0, id: 1, name: 1, archived: 1, isPrimary: 1, branchId: 1, moderator: 1 } })
      .sort({ id: 1 })
      .toArray(),
    loadUsageRows(db, since),
  ]);
  return NextResponse.json({
    ok: true,
    cashboxes: cashboxes.map((c) => ({
      id: Number(c.id),
      name: String(c.name ?? ""),
      archived: !!c.archived,
      isPrimary: !!c.isPrimary,
      branchId: typeof c.branchId === "number" ? c.branchId : undefined,
      owner: typeof c.moderator === "string" ? c.moderator : "",
    })),
    usage: buildMethodUsage(usageRows),
    since,
    days: USAGE_DAYS,
  });
}
