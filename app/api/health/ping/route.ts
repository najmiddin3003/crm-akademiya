import { NextResponse } from "next/server";
import { healthHeaders, healthNode } from "@/lib/health";

// GET /api/health/ping — server "tirik" javobi, bazasiz. Tezlik poygasi
// sahifasi (/tezlik) shu bilan sof tarmoq yo'lini o'lchaydi: brauzer →
// server → brauzer. Hech qanday ma'lumot qaytarmaydi, sessiya talab
// qilmaydi (scripts/gen-api-permissions.mjs → PUBLIC).
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true, node: healthNode() }, { headers: healthHeaders() });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: healthHeaders() });
}
