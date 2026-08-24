import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { normalizeCashbox, zeroMethodTotals, type Cashbox } from "@/lib/cashboxes";
import { loadPaymentMethodKeys } from "@/lib/paymentMethods";

// Moliya → Kassalar backend'i (MongoDB `cashboxes`). Demo seed YO'Q —
// kassalarni foydalanuvchi o'zi qo'shadi.
export async function GET() {
  const db = await ensureIndexes();
  const col = db.collection("cashboxes");
  const keys = await loadPaymentMethodKeys(db);
  const rows = await col.find({}).sort({ id: 1 }).toArray();
  const cashboxes = rows.map(({ _id, ...rest }) => normalizeCashbox({ isPrimary: false, ...rest }, keys));
  return NextResponse.json({ ok: true, cashboxes });
}

export async function POST(req: Request) {
  let body: Partial<Cashbox>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const name = (body.name || "").trim();
  if (!name) {
    return NextResponse.json({ ok: false, error: "Kassa nomini kiriting" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const col = db.collection("cashboxes");

  // Bitta moderator — bitta kassa. Oynada band moderatorlar hira turadi,
  // ammo tekshiruv shu yerda ham kerak: aks holda so'rovni to'g'ridan-to'g'ri
  // yuborib ikkita kassaga bir odamni biriktirib qo'yish mumkin bo'lardi.
  const moderator = (body.moderator || "").trim();
  if (moderator) {
    const taken = await col.findOne({ moderator });
    if (taken) {
      return NextResponse.json(
        { ok: false, error: `${moderator} allaqachon "${taken.name}" kassasiga biriktirilgan` },
        { status: 400 },
      );
    }
  }

  const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  const nextId = (last[0]?.id ?? 0) + 1;

  const cashbox: Cashbox = {
    id: nextId,
    name,
    balance: 0,
    moderator,
    onlinePayment: !!body.onlinePayment,
    archived: !!body.archived,
    isPrimary: false,
    methodTotals: zeroMethodTotals(await loadPaymentMethodKeys(db)),
  };
  await col.insertOne({ ...cashbox });
  return NextResponse.json({ ok: true, cashbox });
}
