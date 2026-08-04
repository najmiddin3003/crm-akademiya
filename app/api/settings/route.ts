import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import type { SettingsDoc } from "@/lib/settings";

// Sozlamalar backend'i (MongoDB `settings`).
//
// GET  /api/settings?key=general.finance   → bitta guruh
// GET  /api/settings?prefix=general.       → prefiks bo'yicha bir nechta
// PUT  /api/settings                       → { key, values } upsert
//
// Seed YO'Q — saqlanmagan kalit uchun bo'sh obyekt qaytadi va klient
// konfiguratsiyadagi default qiymatlarni ishlatadi. Shu sababli yangi
// maydon qo'shish migratsiyasiz ishlaydi.

export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  const prefix = url.searchParams.get("prefix");

  const db = await ensureIndexes();
  const col = db.collection("settings");

  if (key) {
    const doc = await col.findOne({ key });
    return NextResponse.json({ ok: true, values: doc?.values ?? {} });
  }

  const filter = prefix ? { key: { $regex: `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}` } } : {};
  const rows = await col.find(filter).toArray();
  const groups: Record<string, unknown> = {};
  for (const r of rows) groups[String(r.key)] = r.values ?? {};
  return NextResponse.json({ ok: true, groups });
}

export async function PUT(req: Request) {
  let body: Partial<SettingsDoc>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const key = (body.key || "").trim();
  if (!key) {
    return NextResponse.json({ ok: false, error: "Sozlama kaliti yo'q" }, { status: 400 });
  }
  if (!body.values || typeof body.values !== "object") {
    return NextResponse.json({ ok: false, error: "Qiymatlar yo'q" }, { status: 400 });
  }

  const db = await ensureIndexes();
  await db.collection("settings").updateOne(
    { key },
    { $set: { key, values: body.values } },
    { upsert: true },
  );

  return NextResponse.json({ ok: true });
}
