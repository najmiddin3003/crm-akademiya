import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { healthHeaders, healthNode } from "@/lib/health";

// GET /api/health/db — bazaga BITTA arzon so'rov (`branches` dan bitta
// hujjatning _id si) va uning serverdagi davomiyligi. Barmoq sinovi
// (/tezlik, components/tezlik/TapTest.tsx) aynan shu so'rovni o'lchaydi:
// brauzer → server → baza → brauzer. Ma'lumot qaytarmaydi, sessiya
// talab qilmaydi (PUBLIC).
export const dynamic = "force-dynamic";

export async function GET() {
  const t0 = performance.now();
  try {
    const db = await getDb();
    await db.collection("branches").findOne({}, { projection: { _id: 1 } });
    const dbMs = Math.round((performance.now() - t0) * 10) / 10;
    return NextResponse.json({ ok: true, dbMs, node: healthNode() }, { headers: healthHeaders() });
  } catch {
    return NextResponse.json({ ok: false, error: "Bazaga ulanib bo'lmadi" }, { status: 503, headers: healthHeaders() });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: healthHeaders() });
}
