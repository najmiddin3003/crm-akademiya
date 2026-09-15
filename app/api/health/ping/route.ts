import { NextResponse } from "next/server";
import { healthHeaders, healthNode } from "@/lib/health";

// GET /api/health/ping — server "tirik" javobi, bazasiz (sof tarmoq
// yo'li: brauzer → server → brauzer). 15.09.2026 gacha tezlik poygasi
// (/tezlik) shu bilan "ulanish" bosqichini o'lchardi; poyga olib
// tashlangach ilova ichida ishlatilmaydi — serverning tirikligini
// tashqaridan (curl) tekshirish uchun qoldirilgan. Hech qanday ma'lumot
// qaytarmaydi, sessiya talab qilmaydi (scripts/gen-api-permissions.mjs
// → PUBLIC).
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true, node: healthNode() }, { headers: healthHeaders() });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: healthHeaders() });
}
