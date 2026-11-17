import { NextResponse } from "next/server";
import { currentAuthorName } from "@/lib/currentEmployee";
import { holidaysPage, notifyHoliday, saveHoliday, saveWeek } from "@/lib/holidays";
import { ensureIndexes } from "@/lib/mongodb";
import { reportCtx } from "@/lib/reportRoute";

// Sozlamalar → Ish kunlari va bayramlar (37-qism, lib/holidays.ts).
//   GET ?branch — o'quv yili dam olish kunlari va ta'siri; POST {action: "save" | "week" | "notify", ...}.
export async function GET(req: Request) {
  const c = await reportCtx(req);
  if (c instanceof NextResponse) return c;
  const db = await ensureIndexes();
  return NextResponse.json(await holidaysPage(db, c.br.ids));
}

export async function POST(req: Request) {
  const c = await reportCtx(req);
  if (c instanceof NextResponse) return c;
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  const db = await ensureIndexes();
  const r =
    b.action === "week"
      ? await saveWeek(db, b as never)
      : b.action === "notify"
        ? await notifyHoliday(db, Number(b.id), c.scope.isAdmin ? (await db.collection("branches").find({}, { projection: { id: 1 } }).toArray()).map((x) => Number(x.id)) : c.scope.allowed)
        : await saveHoliday(db, b, await currentAuthorName());
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
