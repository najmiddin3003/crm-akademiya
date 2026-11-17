import { NextResponse } from "next/server";
import { autoMessagesReport, saveAutoSetting } from "@/lib/autoMessages";
import { currentAuthorName } from "@/lib/currentEmployee";
import { ensureIndexes } from "@/lib/mongodb";
import { reportCtx } from "@/lib/reportRoute";

// Sotuv va marketing → Avtomatik xabarlar (36-qism, lib/autoMessages.ts).
//   GET ?from&to — hodisalar, sozlamalar va statistika; POST {key, enabled, text} — hodisa sozlamasi.
export async function GET(req: Request) {
  const c = await reportCtx(req);
  if (c instanceof NextResponse) return c;
  const db = await ensureIndexes();
  return NextResponse.json(await autoMessagesReport(db, c.from, c.to));
}

export async function POST(req: Request) {
  const c = await reportCtx(req);
  if (c instanceof NextResponse) return c;
  const b = (await req.json().catch(() => null)) as { key?: string; enabled?: boolean; text?: string } | null;
  if (!b?.key) return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  const db = await ensureIndexes();
  const r = await saveAutoSetting(db, b.key, b.enabled !== false, String(b.text ?? ""), await currentAuthorName());
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
