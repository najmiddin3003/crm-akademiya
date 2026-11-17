import { NextResponse } from "next/server";
import { getBranchScope } from "@/lib/branchScope";
import { integrationsStatus } from "@/lib/integrationsStatus";
import { ensureIndexes } from "@/lib/mongodb";

// Sozlamalar → Integratsiyalar (32-qism). GET — tashqi tizimlar holati (lib/integrationsStatus.ts).
// Faqat «bor / yo'q» va sanoqlar; kalit va parollar qaytarilmaydi.

export async function GET() {
  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
  const db = await ensureIndexes();
  return NextResponse.json(await integrationsStatus(db));
}
