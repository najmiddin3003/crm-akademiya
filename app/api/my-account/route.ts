import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getBranchScope } from "@/lib/branchScope";
import { ensureIndexes } from "@/lib/mongodb";
import { myAccount, myPrefs, savePrefs, saveProfile, unlinkTelegram } from "@/lib/myAccount";

// Mening hisobim (37-qism, lib/myAccount.ts) — har xodim faqat o'zini ko'radi va o'zgartiradi.
//   GET — profil, sozlamalar, qurilmalar, so'nggi kirishlar; POST {action: "profile" | "prefs" | "unlink-telegram"}.
export async function GET(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Avtorizatsiya kerak" }, { status: 401 });
  const db = await ensureIndexes();
  // `?lite=1` — faqat sozlamalar (yangi versiya qobig'idagi avtomatik qulf taymeri, 37-qism).
  if (new URL(req.url).searchParams.get("lite") === "1") return NextResponse.json({ ok: true, prefs: await myPrefs(db, me) });
  const r = await myAccount(db, me, await getBranchScope());
  return r ? NextResponse.json(r) : NextResponse.json({ ok: false, error: "Foydalanuvchi topilmadi" }, { status: 404 });
}

export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Avtorizatsiya kerak" }, { status: 401 });
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  const db = await ensureIndexes();
  const r = b.action === "prefs" ? await savePrefs(db, me, (b.prefs ?? {}) as never) : b.action === "unlink-telegram" ? await unlinkTelegram(db, me) : await saveProfile(db, me, b);
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
