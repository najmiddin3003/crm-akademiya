import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { ensureRoles } from "@/lib/roles";

// Boshqaruv → Rollar backend'i (MongoDB `roles`).
//
// FAQAT GET. Rollar soni qat'iy — `teacher` va `moderator` (lib/roles.ts),
// ular birinchi so'rovdayoq yaratiladi. Shu sabab qo'shish/o'chirish yo'q;
// tahrirlash (izoh va ruxsatlar) — PATCH /api/roles/:id.
export async function GET() {
  const db = await ensureIndexes();
  const roles = await ensureRoles(db);
  return NextResponse.json({ ok: true, roles });
}
