import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { attachActionViews } from "@/lib/ai/actions/store";
import { aiDb } from "@/lib/ai/db";
import { deleteConversation, findConversation, latestConversation, listConversations } from "@/lib/ai/store";

// GET    /api/ai/conversations         — oxirgi suhbat (panel ochilganda davom etadi)
// GET    /api/ai/conversations?id=…    — aniq suhbat
// GET    /api/ai/conversations?list=1  — suhbatlar ro'yxati (to'liq ekranning chap
//                                        tomoni): faqat nom va vaqt, xabarlarsiz
// DELETE /api/ai/conversations?id=…    — suhbatni o'chirish («Yangi suhbat» emas —
//                                        tarixni butunlay o'chirish)
//
// Faqat O'Z suhbatlari: `userId` sessiyadan, har so'rovda filtrda (lib/ai/store.ts).

export async function GET(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
  const params = new URL(req.url).searchParams;
  const db = await aiDb();
  if (params.get("list") === "1") {
    return NextResponse.json({ ok: true, conversations: await listConversations(db, me.id) });
  }
  const id = (params.get("id") || "").slice(0, 64);
  const found = id ? await findConversation(db, me.id, id) : await latestConversation(db, me.id);
  // Qoralama kartalari HOZIRGI holati bilan (tasdiqlangan, bekor qilingan, eskirgan).
  const conversation = found ? { ...found, messages: await attachActionViews(db, me.id, found.messages) } : null;
  return NextResponse.json({ ok: true, conversation });
}

export async function DELETE(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
  const id = (new URL(req.url).searchParams.get("id") || "").slice(0, 64);
  if (!id) return NextResponse.json({ ok: false, error: "Suhbat tanlanmagan" }, { status: 400 });
  const db = await aiDb();
  const deleted = await deleteConversation(db, me.id, id);
  return NextResponse.json({ ok: true, deleted });
}
