import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { SETTINGS_LIST_KINDS, pickListFields, type SettingsListItem, type SettingsListKind } from "@/lib/settingsLists";
import { slugifyMethod } from "@/lib/paymentMethods";

// Sozlamalar ro'yxatlari backend'i — `?kind=` bilan barcha oddiy CRUD
// ro'yxatlariga xizmat qiladi (Sabablar, To'lov turlari, Hamkorlar,
// grading tizimi, Hashtag …). Hammasi bir xil shaklda bo'lgani uchun
// har biriga alohida route yozilmadi.

function isKind(v: string | null): v is SettingsListKind {
  return !!v && v in SETTINGS_LIST_KINDS;
}

export async function GET(req: Request) {
  const kind = new URL(req.url).searchParams.get("kind");
  if (!isKind(kind)) {
    return NextResponse.json(
      { ok: false, error: `Noto'g'ri "kind" — ruxsat: ${Object.keys(SETTINGS_LIST_KINDS).join(", ")}` },
      { status: 400 },
    );
  }
  const db = await ensureIndexes();
  const col = db.collection(SETTINGS_LIST_KINDS[kind]);
  const rows = await col.find({}).sort({ id: 1 }).toArray();
  const items = rows.map(({ _id, ...rest }) => rest as unknown as SettingsListItem);
  return NextResponse.json({ ok: true, items });
}

export async function POST(req: Request) {
  const kind = new URL(req.url).searchParams.get("kind");
  if (!isKind(kind)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri kind" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const fields = pickListFields(body);
  const name = String(fields.name ?? "");
  if (!name) {
    return NextResponse.json({ ok: false, error: "Nomini kiriting" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const col = db.collection(SETTINGS_LIST_KINDS[kind]);
  const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  const nextId = (last[0]?.id ?? 0) + 1;

  // Yangi qo'shilgan yozuv hech qachon "tizimli" bo'lmaydi — o'chirilishi mumkin.
  const item = { ...fields, id: nextId, kind, name, system: false } as unknown as SettingsListItem;

  // To'lov turi kassaning `methodTotals` maydonida kalit bo'lib ishlatiladi —
  // nomdan barqaror slug yasaymiz va takrorlanmasligini ta'minlaymiz.
  if (kind === "payment-methods") {
    const existing = await col.find({}).toArray();
    const used = new Set(existing.map((r) => String(r.key)));
    let key = slugifyMethod(name);
    let n = 2;
    while (used.has(key)) key = `${slugifyMethod(name)}${n++}`;
    item.key = key;
  }
  await col.insertOne({ ...item });
  return NextResponse.json({ ok: true, item });
}
