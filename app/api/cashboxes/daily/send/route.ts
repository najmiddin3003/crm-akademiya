import { NextResponse, after } from "next/server";
import { applyCashboxTransferTo } from "@/lib/cashboxTransfer";
import { getCurrentEmployee, nameEq } from "@/lib/currentEmployee";
import { loadDailyHandover, loadPrimary } from "@/lib/dailyHandover";
import { DENOMINATIONS } from "@/lib/dailyHandoverTypes";
import { ensureIndexes } from "@/lib/mongodb";
import { flushSoon } from "@/lib/sync/dispatch";
import { uzDateIso } from "@/lib/uzTime";

// Moliya → Kunlik topshiruv → KASSIR (32-qism, rasm «Kunlik topshiruv · kassir · Telefon»).
//   GET  — o'z kassam: kassadagi naqd/plastik, kutilayotgan topshiruv, oxirgi topshiruv;
//   POST {naqd, denominations, plastik: boolean} — rahbar kassasiga topshirish.
// Topshirish — oddiy kassalararo ko'chirma (lib/cashboxTransfer.ts): pul rahbar ✓ bosgunicha kassirda
// turadi, rahbar «Kunlik topshiruv» sahifasida qabul qiladi. Kassa egasi — `cashboxes.moderator` ismi
// (admin uchun `?cashboxId=`).

async function myCard(cashboxId: number | null) {
  const me = await getCurrentEmployee();
  if (!me) return { error: NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 }) } as const;
  const db = await ensureIndexes();
  const primary = await loadPrimary(db);
  if (!primary) return { error: NextResponse.json({ ok: false, error: "Bosh kassa belgilanmagan" }, { status: 404 }) } as const;
  const box = me.isAdmin
    ? cashboxId
      ? await db.collection("cashboxes").findOne({ id: cashboxId, archived: { $ne: true } })
      : null
    : me.name
      ? await db.collection("cashboxes").findOne({ moderator: nameEq(me.name), archived: { $ne: true }, isPrimary: { $ne: true } })
      : null;
  if (!box) return { error: NextResponse.json({ ok: false, error: "Sizga biriktirilgan kassa yo'q" }, { status: 404 }) } as const;
  if (Number(box.id) === primary.id) return { error: NextResponse.json({ ok: false, error: "Bu bosh kassa — topshirish kerak emas" }, { status: 400 }) } as const;
  const all = await loadDailyHandover(db, uzDateIso().slice(0, 7));
  if (!all.ok) return { error: NextResponse.json(all, { status: 404 }) } as const;
  const card = all.cards.find((c) => c.cashboxId === Number(box.id));
  if (!card) return { error: NextResponse.json({ ok: false, error: "Kassa topilmadi" }, { status: 404 }) } as const;
  return { db, primary, card, all } as const;
}

export async function GET(req: Request) {
  const id = Number(new URL(req.url).searchParams.get("cashboxId")) || null;
  const g = await myCard(id);
  if ("error" in g) return g.error;
  return NextResponse.json({ ok: true, today: g.all.today, primary: g.all.primary, methodNames: g.all.methodNames, card: g.card });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { cashboxId?: number; naqd?: number; plastik?: boolean; denominations?: Record<string, number> };
  const g = await myCard(Number(body.cashboxId) || null);
  if ("error" in g) return g.error;
  if (g.card.pending) return NextResponse.json({ ok: false, error: "Oldingi topshiruv hali tasdiqlanmagan" }, { status: 409 });
  const onHandNaqd = Number(g.card.methods.naqd ?? 0);
  const naqd = Math.round(Number(body.naqd) || 0);
  if (naqd < 0 || naqd > onHandNaqd) return NextResponse.json({ ok: false, error: "Sanalgan naqd kassadagidan ko'p bo'lmasin" }, { status: 400 });
  const counts = Object.entries(body.denominations ?? {})
    .filter(([k, v]) => DENOMINATIONS.includes(Number(k) as never) && Number(v) > 0)
    .map(([k, v]) => `${Number(k).toLocaleString("ru-RU")}×${Math.floor(Number(v))}`);
  const diff = onHandNaqd - naqd;
  const note = [counts.length ? `Kupyuralar: ${counts.join(", ")}` : "", diff ? `kassada ${diff.toLocaleString("ru-RU")} so'm kam sanaldi` : ""].filter(Boolean).join(" · ");
  const sent: string[] = [];
  const legs: { method: string; amount: number }[] = [];
  if (naqd > 0) legs.push({ method: "naqd", amount: naqd });
  if (body.plastik && Number(g.card.methods.plastik ?? 0) > 0) legs.push({ method: "plastik", amount: Number(g.card.methods.plastik) });
  if (!legs.length) return NextResponse.json({ ok: false, error: "Topshiradigan pul yo'q" }, { status: 400 });
  for (const l of legs) {
    const out = await applyCashboxTransferTo(g.db, { fromId: g.card.cashboxId, toCashboxId: g.primary.id, method: l.method, amount: l.amount, note }, { defer: after });
    if (!out.ok) return NextResponse.json({ ok: false, error: out.error, sent }, { status: out.status });
    sent.push(l.method);
  }
  after(async () => flushSoon(g.db));
  return NextResponse.json({ ok: true, sent, total: legs.reduce((a, l) => a + l.amount, 0) });
}
