import { NextResponse, after } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { currentAuthorName, getCurrentEmployee } from "@/lib/currentEmployee";
import { acceptHandover, canHandle, loadDailyHandover, loadPrimary, remindHandover, returnHandover } from "@/lib/dailyHandover";
import { flushSoon } from "@/lib/sync/dispatch";
import { uzDateIso } from "@/lib/uzTime";

// Moliya → Kunlik topshiruv (yangi versiya, 32-qism). Mantiq — lib/dailyHandover.ts.
//   GET  ?month=YYYY-MM — filial kassalari kartalari va oy tarixi;
//   POST {action: "accept", cashboxId, naqd, plastik, denominations?, note?} — qabul / tasdiq;
//   POST {action: "return", cashboxId, comment} — kutilayotganini qaytarish;
//   POST {action: "remind", cashboxId} — xodimlar botida eslatma.
// KIM: admin yoki bosh kassaning egasi (rahbar). Filial kassiri — `cashier: true` javobi; sahifa unga o'z
// kassasini topshirish ekranini ko'rsatadi (app/api/cashboxes/daily/send).

async function guard() {
  const me = await getCurrentEmployee();
  if (!me) return { error: NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 }) } as const;
  const db = await ensureIndexes();
  const primary = await loadPrimary(db);
  if (!primary) return { error: NextResponse.json({ ok: false, error: "Bosh kassa belgilanmagan" }, { status: 404 }) } as const;
  if (!canHandle(me, primary)) return { error: NextResponse.json({ ok: false, error: "Bu sahifa faqat rahbar kassa egasi uchun", cashier: true }, { status: 403 }) } as const;
  return { me, db } as const;
}

export async function GET(req: Request) {
  const g = await guard();
  if ("error" in g) return g.error;
  const raw = new URL(req.url).searchParams.get("month") || "";
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) ? raw : uzDateIso().slice(0, 7);
  const out = await loadDailyHandover(g.db, month);
  if (!out.ok) return NextResponse.json(out, { status: 404 });
  return NextResponse.json(out);
}

export async function POST(req: Request) {
  const g = await guard();
  if ("error" in g) return g.error;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }
  const cashboxId = Number(body.cashboxId);
  if (!Number.isInteger(cashboxId)) return NextResponse.json({ ok: false, error: "Kassani tanlang" }, { status: 400 });
  // Admin uchun `name` null (egalik tekshirilmaydi) — «kim qabul qildi» hisob nomidan.
  const actor = { isAdmin: g.me.isAdmin, name: g.me.name, displayName: g.me.name ?? ((await currentAuthorName()) || null) };
  const action = String(body.action ?? "");
  const out =
    action === "accept"
      ? await acceptHandover(g.db, actor, {
          cashboxId,
          naqd: Number(body.naqd),
          plastik: Number(body.plastik),
          denominations: typeof body.denominations === "object" && body.denominations ? (body.denominations as Record<string, number>) : undefined,
          note: typeof body.note === "string" ? body.note : "",
        })
      : action === "return"
        ? await returnHandover(g.db, actor, cashboxId, String(body.comment ?? ""))
        : action === "remind"
          ? await remindHandover(g.db, cashboxId)
          : ({ ok: false, error: "Noma'lum amal", status: 400 } as const);
  if (!out.ok) return NextResponse.json(out, { status: out.status });
  after(async () => flushSoon(g.db));
  return NextResponse.json(out);
}
