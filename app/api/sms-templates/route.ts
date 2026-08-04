import { NextResponse } from "next/server";
import type { Collection } from "mongodb";
import { ensureIndexes } from "@/lib/mongodb";
import { SMS_TEMPLATE_SEED } from "@/constants/smsTemplates";
import type { SmsTemplate } from "@/lib/smsTemplates";

// Sotuv va marketing → SMS shablonlari backend'i (MongoDB `sms_templates`).
async function seedIfEmpty(col: Collection) {
  if ((await col.countDocuments()) === 0) {
    await col.insertMany(JSON.parse(JSON.stringify(SMS_TEMPLATE_SEED)));
  }
}

export async function GET() {
  const db = await ensureIndexes();
  const col = db.collection("sms_templates");
  await seedIfEmpty(col);
  const rows = await col.find({}).sort({ id: 1 }).toArray();
  const templates = rows.map(({ _id, ...rest }) => rest as unknown as SmsTemplate);
  return NextResponse.json({ ok: true, templates });
}

export async function POST(req: Request) {
  let body: Partial<SmsTemplate>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const title = (body.title || "").trim();
  if (!title) {
    return NextResponse.json({ ok: false, error: "Sarlavhani kiriting" }, { status: 400 });
  }
  const text = (body.text || "").trim();
  if (!text) {
    return NextResponse.json({ ok: false, error: "SMS matnini kiriting" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const col = db.collection("sms_templates");
  const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  const nextId = (last[0]?.id ?? 0) + 1;

  const template: SmsTemplate = {
    id: nextId,
    title,
    audience: body.audience || "O'quvchi",
    text,
  };
  await col.insertOne({ ...template });
  return NextResponse.json({ ok: true, template });
}
