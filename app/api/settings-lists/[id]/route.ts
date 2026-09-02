import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import {
  SETTINGS_LIST_KINDS,
  pickListFields,
  type SettingsListItem,
  type SettingsListKind,
} from "@/lib/settingsLists";

function isKind(v: string | null): v is SettingsListKind {
  return !!v && v in SETTINGS_LIST_KINDS;
}

// PATCH /api/settings-lists/:id?kind=…
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const itemId = Number(id);
  const kind = new URL(req.url).searchParams.get("kind");
  if (!Number.isFinite(itemId) || !isKind(kind)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const set = pickListFields(body);
  // `name` yuborilgan bo'lsa bo'sh bo'lmasligi kerak (yuborilmasa tegilmaydi).
  if ("name" in set && !set.name) {
    return NextResponse.json({ ok: false, error: "Nomini kiriting" }, { status: 400 });
  }
  if (Object.keys(set).length === 0) {
    return NextResponse.json({ ok: false, error: "Yangilanadigan maydon yo'q" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const res = await db.collection(SETTINGS_LIST_KINDS[kind]).findOneAndUpdate(
    { id: itemId },
    { $set: set },
    { returnDocument: "after" },
  );
  if (!res) {
    return NextResponse.json({ ok: false, error: "Yozuv topilmadi" }, { status: 404 });
  }
  const { _id, ...item } = res;
  return NextResponse.json({ ok: true, item: item as unknown as SettingsListItem });
}

// DELETE /api/settings-lists/:id?kind=…
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const itemId = Number(id);
  const kind = new URL(req.url).searchParams.get("kind");
  if (!Number.isFinite(itemId) || !isKind(kind)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const col = db.collection(SETTINGS_LIST_KINDS[kind]);

  // Tizimli yozuvlar (masalan dastlabki 4 to'lov turi) o'chirilmaydi —
  // ular kassa hisob-kitobida ishlatiladi.
  const existing = await col.findOne({ id: itemId });
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Yozuv topilmadi" }, { status: 404 });
  }
  if (existing.system) {
    return NextResponse.json({ ok: false, error: "Tizimli yozuvni o'chirib bo'lmaydi" }, { status: 400 });
  }

  await col.deleteOne({ id: itemId });

  // Soliq o'chirilsa — u biriktirilgan XODIMLARDAN ham yechiladi.
  //
  // NIMA NOTO'G'RI EDI: `hr_employees.taxIds` da o'chirilgan soliqning
  // id'si qolib ketardi. Oqibati ikkita: Xodimlar ro'yxatidagi "Soliq"
  // ustuni uni sanardi ("2 ta soliq"), holbuki hisobga faqat mavjudi
  // kirardi (lib/payrollSources.ts o'chirilganini jimgina tashlaydi); va
  // tanlov oynasida bunday yozuvning katagi umuman chizilmagani uchun
  // uni yechib bo'lmasdi. Amalda uchradi — bitta xodimda `taxIds: [2, 5]`.
  if (kind === "taxes") {
    await db.collection("hr_employees").updateMany(
      { taxIds: itemId },
      { $pull: { taxIds: itemId } } as never,
    );
  }

  return NextResponse.json({ ok: true });
}
