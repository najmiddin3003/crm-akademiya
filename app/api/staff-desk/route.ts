import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ensureIndexes } from "@/lib/mongodb";
import { approvals, decideGift, managerHome, resolveDesk, workerHome } from "@/lib/staffDesk";

// MENEJER / IT / XIZMAT XODIMI ISH STOLI (47-qism, lib/staffDesk.ts). Kim — rol nomi bo'yicha; rahbar — `as=ISM&mode=`.
//   GET  ?view=manager | approvals | worker
//   POST {action: "gift", id, approve, comment}   — referal sovg'a so'rovi (faqat menejer, o'z filiali)
// Topshiriqni tasdiqlash / qaytarish / «Bajardim» — mavjud /api/staff-tasks/:id.
export const dynamic = "force-dynamic";

async function ctx(req: Request, b?: Record<string, unknown> | null) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ ok: false, error: "Kirish kerak" }, { status: 401 }) };
  const db = await ensureIndexes();
  const sp = new URL(req.url).searchParams;
  const who = await resolveDesk(db, user, String(b?.as ?? sp.get("as") ?? "") || null, String(b?.mode ?? sp.get("mode") ?? "") || null);
  if (!who) return { error: NextResponse.json({ ok: false, error: "Bu sahifa menejer, IT va xizmat xodimlari uchun" }, { status: 403 }) };
  return { db, who, sp };
}

export async function GET(req: Request) {
  const c = await ctx(req);
  if ("error" in c) return c.error;
  const view = c.sp.get("view") ?? "manager";
  if (view === "manager") return NextResponse.json({ ok: true, ...(await managerHome(c.db, c.who)) });
  if (view === "approvals") return NextResponse.json({ ok: true, ...(await approvals(c.db, c.who)) });
  if (view === "worker") return NextResponse.json({ ok: true, ...(await workerHome(c.db, c.who)) });
  return NextResponse.json({ ok: false, error: "Noma'lum ko'rinish" }, { status: 400 });
}

export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return NextResponse.json({ ok: false, error: "So'rov o'qilmadi" }, { status: 400 });
  const c = await ctx(req, b);
  if ("error" in c) return c.error;
  if (b.action === "gift") {
    if (c.who.mode !== "manager") return NextResponse.json({ ok: false, error: "Faqat menejer tasdiqlaydi" }, { status: 403 });
    const r = await decideGift(c.db, c.who, Number(b.id), b.approve === true, String(b.comment ?? ""));
    return NextResponse.json(r, { status: r.ok ? 200 : 400 });
  }
  return NextResponse.json({ ok: false, error: "Noma'lum amal" }, { status: 400 });
}
