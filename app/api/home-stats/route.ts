import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getBranchScope } from "@/lib/branchScope";
import { currentAuthorName } from "@/lib/currentEmployee";
import { computeHomeKpis } from "@/lib/homeStats";
import { ensureIndexes } from "@/lib/mongodb";
import { isPathAllowed } from "@/lib/permissions";

// BOSH SAHIFA TEPASIDAGI KPI KARTALARI (lib/homeStats.ts).
//
// HAR DOIM OCHIQ SAHIFANING ROUTE'i: "/home" hamma rolga ochiq
// (ALWAYS_ALLOWED_PATHS), shu sabab bu route'ni bironta bo'lim ruxsatiga
// BOG'LAB BO'LMAYDI — bog'lansa, o'sha ruxsati yo'q xodim uchun butun
// so'rov 403 bo'lardi, teskarisi esa yopiq bo'limning sonlarini hammaga
// ochib qo'yardi. Shuning uchun `SHARED_EXTRA` (sessiya yetarli) va ruxsat
// SHU YERDA, HAR BIR KARTA UCHUN ALOHIDA kesiladi — naqsh
// app/api/sidebar-counts va app/api/notifications dan.
//
// Yopiq kartaning soni umuman so'ralmaydi (Atlas'ga borilmaydi ham).
export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });

  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });

  const can = (href: string) => isPathAllowed(href, me.permissions);

  // Xodim ismi FAQAT lid sanoqlari uchun kerak (lid qamrovining ikkinchi
  // yarmi). Kerak bo'lmasa uni o'qish ikkita ortiqcha Atlas so'rovi bo'lardi.
  const needLeads = can("/orders-list") || can("/first-lessons") || can("/new-students");
  const author = needLeads ? await currentAuthorName() : "";

  const db = await ensureIndexes();
  const cards = await computeHomeKpis({ db, scope, author, can });

  return NextResponse.json({ ok: true, cards });
}
