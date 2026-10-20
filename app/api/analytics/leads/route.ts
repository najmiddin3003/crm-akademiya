import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { branchInCondition, getBranchScope } from "@/lib/branchScope";
import { funnelOf, leadInRange, type DayRange, type LeadLike } from "@/lib/financeAnalytics";
import { ensureIndexes } from "@/lib/mongodb";

// GET /api/analytics/leads?from=&to=[&cfrom=&cto=][&branchId=] — Moliya analitikasi
// (yangi versiya) → «Lid → o'quvchi»: davrda KELGAN lidlar qaysi bosqichga yetib
// bordi va qaysi manba yaxshi ishladi; solishtirish davri uchun faqat soni va
// guruhga qo'shilgani (konversiya). Hisob — lib/financeAnalytics.ts (funnelOf).
//
// Faqat YIG'INDI qaytadi — ism, telefon yo'q. Ruxsat — /finance-analytics bo'limi
// (lib/apiPermissions.generated.ts). QAMROV: foydalanuvchi ko'ra oladigan filiallar
// (`scope.allowed` — admin hammasi); `branchId` berilsa — faqat o'sha (ro'yxatda
// bo'lishi shart). Navbardagi tanlov EMAS — sahifadagi «Filial» filtri moliya
// raqamlari bilan bir xil ishlasin. Filiali yo'q eski lid — 1-filial (branchInCondition).

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const from = sp.get("from") || "";
  const to = sp.get("to") || "";
  const cfrom = sp.get("cfrom") || "";
  const cto = sp.get("cto") || "";
  if (!ISO.test(from) || !ISO.test(to) || from > to) return bad("Noto'g'ri davr (from/to, YYYY-MM-DD)");
  if ((cfrom || cto) && (!ISO.test(cfrom) || !ISO.test(cto) || cfrom > cto)) return bad("Noto'g'ri solishtirish davri");

  const [me, scope] = await Promise.all([getCurrentUser(), getBranchScope()]);
  if (!me || !scope) return bad("Tizimga kirmagansiz", 401);

  let ids = scope.allowed;
  const branchRaw = sp.get("branchId");
  if (branchRaw) {
    const b = Number(branchRaw);
    if (!Number.isInteger(b) || !ids.includes(b)) return bad("Bu filial sizga ochiq emas", 403);
    ids = [b];
  }

  const db = await ensureIndexes();
  const rows = (await db
    .collection("orders")
    .find(branchInCondition(ids), {
      projection: {
        _id: 0,
        created: 1,
        source: 1,
        holat: 1,
        groupId: 1,
        status: 1,
        leadStatus: 1,
        firstLesson: 1,
        firstLessonStatus: 1,
        stage: 1,
        "holatTarix.kind": 1,
        "holatTarix.holat": 1,
        "holatTarix.from": 1,
      },
    })
    .toArray()) as unknown as LeadLike[];

  const period: DayRange = { from, to };
  const stats = funnelOf(rows.filter((o) => leadInRange(o, period)));
  const compare = cfrom && cto ? funnelOf(rows.filter((o) => leadInRange(o, { from: cfrom, to: cto }))) : null;
  return NextResponse.json({
    ok: true,
    period: stats,
    compare: compare ? { total: compare.total, joined: compare.joined } : null,
  });
}
