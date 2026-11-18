import { NextResponse } from "next/server";
import { getBranchScope } from "@/lib/branchScope";
import { ensureIndexes } from "@/lib/mongodb";
import { smsDevicesPage } from "@/lib/smsDevicesPage";

// Integratsiyalar → SMS qurilmalar (40-qism, lib/smsDevicesPage.ts) — faqat direktor, faqat o'qish.
// Qo'shish/tahrir — /api/settings-lists?kind=sms-devices.
export async function GET() {
  const scope = await getBranchScope();
  if (!scope?.isAdmin) return NextResponse.json({ ok: false, error: "Faqat direktor uchun" }, { status: 403 });
  const db = await ensureIndexes();
  return NextResponse.json(await smsDevicesPage(db));
}
