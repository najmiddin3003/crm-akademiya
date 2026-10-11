import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { attachActionViews } from "@/lib/ai/actions/store";
import { aiDb } from "@/lib/ai/db";
import { deleteConversation, findConversation, latestConversation, listConversations, setArchived } from "@/lib/ai/store";

// GET    /api/ai/conversations                — oxirgi FAOL suhbat (panel ochilganda davom etadi)
// GET    /api/ai/conversations?id=…           — aniq suhbat (arxivdagisi ham)
// GET    /api/ai/conversations?list=1         — faol suhbatlar ro'yxati (to'liq ekranning chap
//                                               tomoni): faqat nom va vaqt, xabarlarsiz
// GET    /api/ai/conversations?list=1&archived=1 — arxiv (11.10.2026)
// PATCH  /api/ai/conversations?id=…  {archived} — arxivlash / arxivdan qaytarish
// DELETE /api/ai/conversations?id=…           — savatcha: xodimdan yashiriladi, bazada qoladi
//
// 30 kun yozilmagan suhbat ro'yxat ochilganda o'zi arxivga o'tadi
// (lib/ai/store.ts → autoArchive) — o'chmaydi.
//
// Faqat O'Z suhbatlari: `userId` sessiyadan, har so'rovda filtrda (lib/ai/store.ts).

export async function GET(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
  const params = new URL(req.url).searchParams;
  const db = await aiDb();
  if (params.get("list") === "1") {
    const archived = params.get("archived") === "1";
    return NextResponse.json({ ok: true, archived, conversations: await listConversations(db, me.id, { archived }) });
  }
  const id = (params.get("id") || "").slice(0, 64);
  const found = id ? await findConversation(db, me.id, id) : await latestConversation(db, me.id);
  // Qoralama kartalari HOZIRGI holati bilan (tasdiqlangan, bekor qilingan, eskirgan).
  const conversation = found ? { ...found, messages: await attachActionViews(db, me.id, found.messages) } : null;
  return NextResponse.json({ ok: true, conversation });
}

export async function PATCH(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
  const id = (new URL(req.url).searchParams.get("id") || "").slice(0, 64);
  if (!id) return NextResponse.json({ ok: false, error: "Suhbat tanlanmagan" }, { status: 400 });
  let body: { archived?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }
  if (typeof body.archived !== "boolean") {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }
  const db = await aiDb();
  const ok = await setArchived(db, me.id, id, body.archived);
  if (!ok) return NextResponse.json({ ok: false, error: "Suhbat topilmadi" }, { status: 404 });
  return NextResponse.json({ ok: true, archived: body.archived });
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
