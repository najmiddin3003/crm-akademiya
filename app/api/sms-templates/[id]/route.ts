import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import type { SmsTemplate } from "@/lib/smsTemplates";

// PATCH /api/sms-templates/:id — shablonni tahrirlaydi.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const templateId = Number(id);
  if (!Number.isFinite(templateId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  let body: Partial<SmsTemplate>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const set: Record<string, unknown> = {};
  if (typeof body.title === "string") {
    const title = body.title.trim();
    if (!title) return NextResponse.json({ ok: false, error: "Sarlavhani kiriting" }, { status: 400 });
    set.title = title;
  }
  if (typeof body.text === "string") {
    const text = body.text.trim();
    if (!text) return NextResponse.json({ ok: false, error: "SMS matnini kiriting" }, { status: 400 });
    set.text = text;
  }
  if (typeof body.audience === "string") set.audience = body.audience;
  if (Object.keys(set).length === 0) {
    return NextResponse.json({ ok: false, error: "Yangilanadigan maydon yo'q" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const res = await db.collection("sms_templates").findOneAndUpdate(
    { id: templateId },
    { $set: set },
    { returnDocument: "after" },
  );
  if (!res) {
    return NextResponse.json({ ok: false, error: "Shablon topilmadi" }, { status: 404 });
  }
  const { _id, ...template } = res;
  return NextResponse.json({ ok: true, template: template as unknown as SmsTemplate });
}

// DELETE /api/sms-templates/:id
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const templateId = Number(id);
  if (!Number.isFinite(templateId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  const db = await ensureIndexes();
  const res = await db.collection("sms_templates").deleteOne({ id: templateId });
  if (res.deletedCount === 0) {
    return NextResponse.json({ ok: false, error: "Shablon topilmadi" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
