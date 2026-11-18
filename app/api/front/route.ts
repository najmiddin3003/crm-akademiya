import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ensureIndexes } from "@/lib/mongodb";
import { adminHome, callQueue, myCallStats, resolveFront, saveCall } from "@/lib/frontDesk";

// QABUL ADMIN VA MODERATOR ISH STOLI (46-qism, lib/frontDesk.ts). Kim — `turi = moderator` xodimi (o'z filiali);
// rahbar — `as=ISM` (+ `mode=admin|moderator`).
//   GET  ?view=admin | queue | stats&period=bugun|hafta|oy
//   POST {action: "call", target: {type, id}, kind, result, next, callbackAt, note, nextText}
export const dynamic = "force-dynamic";

async function ctx(req: Request, b?: Record<string, unknown> | null) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ ok: false, error: "Kirish kerak" }, { status: 401 }) };
  const db = await ensureIndexes();
  const sp = new URL(req.url).searchParams;
  const who = await resolveFront(db, user, String(b?.as ?? sp.get("as") ?? "") || null, String(b?.mode ?? sp.get("mode") ?? "") || null);
  if (!who) return { error: NextResponse.json({ ok: false, error: "Bu sahifa qabul admin va moderatorlar uchun" }, { status: 403 }) };
  return { db, who, sp };
}

export async function GET(req: Request) {
  const c = await ctx(req);
  if ("error" in c) return c.error;
  const view = c.sp.get("view") ?? "admin";
  if (view === "admin") return NextResponse.json({ ok: true, ...(await adminHome(c.db, c.who)) });
  if (view === "queue") return NextResponse.json({ ok: true, ...(await callQueue(c.db, c.who)) });
  if (view === "stats") {
    const p = c.sp.get("period");
    return NextResponse.json({ ok: true, ...(await myCallStats(c.db, c.who, p === "bugun" || p === "hafta" ? p : "oy")) });
  }
  return NextResponse.json({ ok: false, error: "Noma'lum ko'rinish" }, { status: 400 });
}

export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return NextResponse.json({ ok: false, error: "So'rov o'qilmadi" }, { status: 400 });
  const c = await ctx(req, b);
  if ("error" in c) return c.error;
  if (b.action === "call") {
    const r = await saveCall(c.db, c.who, b);
    return NextResponse.json(r, { status: r.ok ? 200 : 400 });
  }
  return NextResponse.json({ ok: false, error: "Noma'lum amal" }, { status: 400 });
}
