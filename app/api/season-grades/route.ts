import { NextResponse } from "next/server";
import { currentAuthorName } from "@/lib/currentEmployee";
import { ensureIndexes } from "@/lib/mongodb";
import { reportCtx } from "@/lib/reportRoute";
import { saveCriteria, saveGrade, seasonGroup, seasonOverview, sendSeason } from "@/lib/seasonGrades";

// O'quv bo'limi → Mavsumiy baholash (36-qism, lib/seasonGrades.ts).
//   GET ?season&branch — guruhlar va holat; GET ?season&group — guruh o'quvchilari va baholari.
//   POST {action: "grade" | "criteria" | "send", ...}.
export async function GET(req: Request) {
  const c = await reportCtx(req);
  if (c instanceof NextResponse) return c;
  const db = await ensureIndexes();
  const group = Number(c.sp.get("group"));
  if (group) {
    const r = await seasonGroup(db, String(c.sp.get("season") ?? ""), group);
    return r ? NextResponse.json(r) : NextResponse.json({ ok: false, error: "Guruh topilmadi" }, { status: 404 });
  }
  return NextResponse.json(await seasonOverview(db, c.br.ids, c.sp.get("season")));
}

export async function POST(req: Request) {
  const c = await reportCtx(req);
  if (c instanceof NextResponse) return c;
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  const db = await ensureIndexes();
  const by = await currentAuthorName();
  const r =
    b.action === "criteria"
      ? await saveCriteria(db, String(b.course ?? ""), Array.isArray(b.criteria) ? b.criteria.map(String) : [])
      : b.action === "send"
        ? await sendSeason(db, c.br.ids, String(b.season ?? ""), by)
        : await saveGrade(db, b as never, by);
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
