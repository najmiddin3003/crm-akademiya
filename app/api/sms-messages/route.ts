import { NextResponse } from "next/server";
import type { Collection } from "mongodb";
import { ensureIndexes } from "@/lib/mongodb";
import { SM_RECIPIENTS, SM_MODERATORS, SM_BODIES, SM_AMOUNTS, SM_TOTAL, SM_DAYS } from "@/constants/smsMessages";
import type { SmsMessage, SmsKind } from "@/lib/smsMessages";

// Sotuv va marketing → Xabarlar ro'yhati backend'i (MongoDB `sms_messages`).
// Sof jurnal — faqat GET. Bo'sh bo'lsa deterministik LCG bilan demo
// yozuvlarni seed qiladi (loyihadagi boshqa jurnal sahifalari kabi).

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function buildSeed(): SmsMessage[] {
  const today = new Date();
  const rows: SmsMessage[] = [];

  for (let i = 1; i <= SM_TOTAL; i++) {
    // Seed aralashtiriladi va bir necha qiymat tashlanadi — ketma-ket
    // seed'lar LCG'da korrelyatsiyalanib bir xil natija berib qo'ymasligi uchun.
    let seed = (i * 7919 + 104729) % 233280;
    const rnd = (min: number, max: number) => {
      seed = (seed * 9301 + 49297) % 233280;
      return Math.floor((seed / 233280) * (max - min + 1)) + min;
    };
    for (let w = 0; w < 6; w++) rnd(0, 1);

    const dayOffset = rnd(0, SM_DAYS - 1);
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dayOffset);
    const body = SM_BODIES[rnd(0, SM_BODIES.length - 1)];
    const name = SM_RECIPIENTS[rnd(0, SM_RECIPIENTS.length - 1)];
    const amount = SM_AMOUNTS[rnd(0, SM_AMOUNTS.length - 1)];
    const statusRoll = rnd(0, 99);

    rows.push({
      id: i,
      recipientName: name,
      text: body.text
        .replace(/\{name\}/g, name)
        .replace(/\{amount\}/g, amount.toLocaleString("ru-RU")),
      date: `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`,
      time: `${pad2(rnd(8, 20))}:${pad2(rnd(0, 59))}`,
      moderator: SM_MODERATORS[rnd(0, SM_MODERATORS.length - 1)],
      status: statusRoll < 88 ? "Qabul qilindi" : statusRoll < 96 ? "Kutilmoqda" : "Yuborilmadi",
      kind: body.kind as SmsKind,
    });
  }

  return rows;
}

async function seedIfEmpty(col: Collection) {
  if ((await col.countDocuments()) === 0) {
    await col.insertMany(buildSeed().map((r) => ({ ...r })));
  }
}

export async function GET() {
  const db = await ensureIndexes();
  const col = db.collection("sms_messages");
  await seedIfEmpty(col);
  const rows = await col.find({}).sort({ date: -1, id: -1 }).toArray();
  const messages = rows.map(({ _id, ...rest }) => rest as unknown as SmsMessage);
  return NextResponse.json({ ok: true, messages });
}
