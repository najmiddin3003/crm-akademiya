import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { isSelfServeSource } from "@/lib/leadSettings";
import { SOURCE_COLLECTION, cleanSourceName, isReservedSourceName, listSourceOptions } from "@/lib/studentSources";

// "Manba" tanlovlarini BOSHQARISH — qo'shish / nomini o'zgartirish /
// o'chirish. Sotuv va marketing → O'quvchilar oqimi sahifasidagi oyna
// shu route bilan ishlaydi.
//
// Yangi versiya «Sozlamalar → Lidlar → Manbalar» (24-qism, 13.11.2026) ham shu yerda:
// PATCH `{ id, active }` — Faol/Nofaol, `{ id, paid }` — Pullik/Bepul belgisi
// (lib/studentSources.ts). Nom bilan birga yuborilishi ham mumkin.
//
// NEGA O'QISHDAN AJRATILGAN: qo'shni /api/student-sources/options ni
// o'quvchi qo'shish oynasi turgan har bir sahifa chaqiradi, ya'ni u
// sahifalarning ruxsati bu route'ga ham tarqab ketardi (ruxsatlar jadvali
// route'ni sahifaga bog'laydi, metodga emas). Ajratilgani uchun yozish
// huquqi faqat /sales-sources ruxsatiga bog'lanadi.

/** Ro'yxat javobi — har uchala amaldan keyin bir xil shaklda qaytadi. */
async function currentList() {
  const db = await ensureIndexes();
  return NextResponse.json({ ok: true, options: await listSourceOptions(db) });
}

async function body(req: Request): Promise<Record<string, unknown> | null> {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// POST — yangi manba qo'shadi.
export async function POST(req: Request) {
  const b = await body(req);
  if (!b) return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });

  const name = cleanSourceName(b.name);
  if (!name) return NextResponse.json({ ok: false, error: "Manba nomini kiriting" }, { status: 400 });
  if (isReservedSourceName(name)) return NextResponse.json({ ok: false, error: "Bu nom tizimda band — boshqa nom tanlang" }, { status: 400 });

  const db = await ensureIndexes();
  // Urug' hali yozilmagan bo'lishi mumkin — avval ro'yxatni tiklaymiz,
  // aks holda yangi qiymat qo'shilgan zahoti kolleksiya "bo'sh emas"
  // bo'lib qolar va standart 7 ta tanlov umuman paydo bo'lmasdi.
  await listSourceOptions(db);
  const col = db.collection(SOURCE_COLLECTION);

  // TAKROR NOM O'TMAYDI. Qiymat `pupils.source` ga matn bo'lib tushadi va
  // taqsimot shu matn bo'yicha guruhlanadi — ikkita bir xil nomli tanlov
  // ro'yxatda ikkita, diagrammada esa bitta ustun bo'lib ko'rinardi.
  const clash = await col.findOne({ name: { $regex: `^${escapeRegex(name)}$`, $options: "i" } });
  if (clash) {
    const error = clash.active === false ? "Bunday manba bor — nofaol. Uni qayta faollashtiring" : "Bunday manba allaqachon bor";
    return NextResponse.json({ ok: false, error }, { status: 400 });
  }

  const paid = b.paid === true;
  const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  await col.insertOne({ id: (last[0]?.id ?? 0) + 1, name, system: false, ...(paid ? { paid } : {}) });
  return currentList();
}

// PATCH — nomini o'zgartiradi (tanani: { id, name }); yangi versiyadan — { id, active }
// va/yoki { id, paid } (nomsiz ham).
export async function PATCH(req: Request) {
  const b = await body(req);
  if (!b) return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });

  const id = Number(b.id);
  if (!Number.isFinite(id)) return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  const flags: { active?: boolean; paid?: boolean } = {};
  if (typeof b.active === "boolean") flags.active = b.active;
  if (typeof b.paid === "boolean") flags.paid = b.paid;
  const hasName = b.name !== undefined;
  const name = cleanSourceName(b.name);
  if (hasName || Object.keys(flags).length === 0) {
    if (!name) return NextResponse.json({ ok: false, error: "Manba nomini kiriting" }, { status: 400 });
    if (isReservedSourceName(name)) return NextResponse.json({ ok: false, error: "Bu nom tizimda band — boshqa nom tanlang" }, { status: 400 });
  }

  const db = await ensureIndexes();
  await listSourceOptions(db);
  const col = db.collection(SOURCE_COLLECTION);

  const row = await col.findOne({ id });
  if (!row) return NextResponse.json({ ok: false, error: "Manba topilmadi" }, { status: 404 });

  if (flags.active === false && row.active !== false) {
    // «Tavsiya» — o'quvchilar ro'yxatidagi «Tavsiyalarni yuklash» va referal shunga bog'liq.
    if (row.system) return NextResponse.json({ ok: false, error: "Tizimli manbani nofaol qilib bo'lmaydi" }, { status: 400 });
    // Oxirgisi o'chsa formalar konstantadagi eski ro'yxatga qaytib ketardi (useStudentSources).
    const others = await col.countDocuments({ id: { $ne: id }, active: { $ne: false } });
    if (others === 0) return NextResponse.json({ ok: false, error: "Kamida bitta faol manba qolsin" }, { status: 400 });
  }
  if (!hasName || cleanSourceName(row.name) === name) {
    if (Object.keys(flags).length > 0) await col.updateOne({ id }, { $set: flags });
    return currentList();
  }
  if (row.system) {
    return NextResponse.json(
      { ok: false, error: "Tizimli manba nomini o'zgartirib bo'lmaydi" },
      { status: 400 },
    );
  }

  const clash = await col.findOne({
    id: { $ne: id },
    name: { $regex: `^${escapeRegex(name)}$`, $options: "i" },
  });
  if (clash) return NextResponse.json({ ok: false, error: "Bunday manba allaqachon bor" }, { status: 400 });

  const oldName = String(row.name ?? "");
  await col.updateOne({ id }, { $set: { name, ...flags } });

  // MAVJUD O'QUVCHILAR HAM YANGILANADI.
  //
  // `pupils.source` — MATN, ro'yxatga havola emas. Faqat tanlov nomi
  // o'zgartirilsa, eski matn o'quvchilarda qolib ketardi va O'quvchilar
  // oqimi diagrammasida bitta manba IKKITA ustun bo'lib ko'rinardi
  // ("Telegram" va "Telegram reklama") — ya'ni "nomini tuzatdim" degan
  // oddiy amal hisobotni jimgina buzardi.
  let renamed = 0;
  if (oldName && oldName !== name) {
    const r = await db.collection("pupils").updateMany({ source: oldName }, { $set: { source: name } });
    renamed = r.modifiedCount;
    // LIDLAR HAM (13.11.2026): manbalar sahifasidagi «lid → o'quvchi» `orders.source`
    // (qo'lda qo'shilgan lid — o'quvchi kartasidan) va `orders.heardFrom` (so'rovnoma/bot
    // javobi) matni bo'yicha sanaydi — aks holda nom tuzatilgach bitta manba ikkiga bo'linardi.
    if (!isSelfServeSource(oldName)) {
      await Promise.all([
        db.collection("orders").updateMany({ source: oldName }, { $set: { source: name } }),
        db.collection("orders").updateMany({ heardFrom: oldName }, { $set: { heardFrom: name } }),
      ]);
    }
  }

  const res = await currentList();
  const data = await res.json();
  return NextResponse.json({ ...data, renamed });
}

// DELETE /api/student-sources/options/manage?id=…
export async function DELETE(req: Request) {
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isFinite(id)) return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });

  const db = await ensureIndexes();
  await listSourceOptions(db);
  const col = db.collection(SOURCE_COLLECTION);

  const row = await col.findOne({ id });
  if (!row) return NextResponse.json({ ok: false, error: "Manba topilmadi" }, { status: 404 });
  if (row.system) {
    return NextResponse.json({ ok: false, error: "Tizimli manbani o'chirib bo'lmaydi" }, { status: 400 });
  }

  // O'QUVCHILARGA TEGILMAYDI — ataylab. Tanlov ro'yxatdan chiqadi, lekin
  // ilgari shu manba yozilgan o'quvchilarning tarixi o'zgarmaydi va
  // taqsimotda ko'rinib turaveradi. Aks holda o'tgan oyning hisoboti
  // ro'yxat tahriri tufayli o'zgarib ketardi.
  await col.deleteOne({ id });
  return currentList();
}

/** Foydalanuvchi kiritgan matnni $regex ichiga xavfsiz qo'yish uchun. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
