import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ensureIndexes } from "@/lib/mongodb";
import { getBranchScope } from "@/lib/branchScope";
import { computeActiveStudents } from "@/lib/reportStudents";
import { ISO_DAY, reportBranchIds } from "@/lib/reportScope";
import { canOpenReport, REPORT_BY_SLUG } from "@/lib/reportsCatalog";
import { uzDateIso, uzTimeHm } from "@/lib/uzTime";

// GET /api/reports/active-students — Hisobotlar → «Faol o'quvchilar» (27-qism, rasmlar
// 47–50, 14.11.2026): tanlangan kun holatiga guruhda o'qiyotganlar — kurs (kategoriya
// bo'yicha), guruh va o'qituvchi kesimida, to'lov holati va xona sig'imi bilan.
//   ?date=YYYY-MM-DD   hisob kuni (sukut — bugun; kelajak — bugun; tarix boshidan oldin —
//                      tarix boshi, a'zolik yozuvlari 20.09.2026 dan)
//   ?branch=all|<id>   filial (sukut — ruxsat etilgan hammasi, 1+2 hovuzi birga)
//   ?category=<nom>    kurs kategoriyasi (`offline_courses.category`); "-" — kategoriyasiz
// Hisob qoidasi — lib/reportStudents.ts (computeActiveStudents) va lib/reportActiveSeats.ts.
//
// RUXSAT shu yerda — hisobot sahifasi bilan bir xil (lib/reportsCatalog.ts, `canOpenReport`:
// «Aktiv o'quvchilar» yoki «Guruhlar»). To'lov holati (Qarzdor / To'lagan) shu ruxsat bilan
// ham ko'rinadi: ikkala bo'lim o'quvchi balansini allaqachon ko'rsatadi
// (/api/students/balances ularga ochiq) — bu yerda faqat sonlar, ism yo'q. Faqat o'qiydi.
export async function GET(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
  const def = REPORT_BY_SLUG["faol-oquvchilar"];
  if (!def || !canOpenReport(def, me.permissions)) {
    return NextResponse.json({ ok: false, error: "Bu bo'limga ruxsatingiz yo'q" }, { status: 403 });
  }

  const sp = new URL(req.url).searchParams;
  const rawDate = (sp.get("date") || "").trim();
  if (rawDate && !ISO_DAY.test(rawDate)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri sana (YYYY-MM-DD kutilgan)" }, { status: 400 });
  }

  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
  const br = reportBranchIds(scope, sp.get("branch"));
  if (!br) return NextResponse.json({ ok: false, error: "Bu filial sizga biriktirilmagan" }, { status: 403 });

  const today = uzDateIso();
  const db = await ensureIndexes();
  const report = await computeActiveStudents(db, br.ids, {
    date: rawDate && rawDate < today ? rawDate : today,
    today,
    time: uzTimeHm(),
    category: sp.get("category") || undefined,
    scope,
  });
  return NextResponse.json({ ok: true, branch: br.branch, ...report });
}
