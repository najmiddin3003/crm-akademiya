import { NextResponse } from "next/server";
import type { Collection } from "mongodb";
import { ensureIndexes } from "@/lib/mongodb";
import { TURNSTILE_IO_PEOPLE, TURNSTILE_IO_DAYS } from "@/constants/turnstileIo";
import type { TurnstileIoRecord, TurnstileIoStatus } from "@/lib/turnstileIo";

// Nazorat → Turniket kirish-chiqish analitikasi backend'i
// (MongoDB `turnstile_io`). Bo'sh bo'lsa demo yozuvlarni seed qiladi.
//
// Seed deterministik LCG bilan yaratiladi (loyihadagi lib/turnstile.ts va
// lib/missedGroups.ts bilan bir xil yondashuv) — shu sababli bir xil kun
// uchun har doim bir xil natija chiqadi, lekin sanalar seed qilingan
// paytdagi "bugun"ga bog'lanadi.

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
function toIso(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function buildSeed(): TurnstileIoRecord[] {
  const today = new Date();
  const rows: TurnstileIoRecord[] = [];
  let id = 0;

  for (let dayOffset = 0; dayOffset < TURNSTILE_IO_DAYS; dayOffset++) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dayOffset);
    const iso = toIso(date);

    TURNSTILE_IO_PEOPLE.forEach((person, personIndex) => {
      // Ketma-ket seed'lar LCG'da o'zaro korrelyatsiyalanadi (qo'shni
      // personIndex'lar deyarli bir xil qiymat berardi), shuning uchun
      // seed aralashtiriladi va birinchi bir necha qiymat tashlab yuboriladi.
      let seed = ((dayOffset + 1) * 7919 + (personIndex + 1) * 104729) % 233280;
      const rnd = (min: number, max: number) => {
        seed = (seed * 9301 + 49297) % 233280;
        return Math.floor((seed / 233280) * (max - min + 1)) + min;
      };
      for (let w = 0; w < 6; w++) rnd(0, 1);

      id += 1;
      const roll = rnd(0, 99);
      // Bugungi kun uchun ko'pchilik hali kelmagan bo'ladi (referens saytda
      // ham shunday) — o'tgan kunlar uchun taqsimot realroq.
      const absentCutoff = dayOffset === 0 ? 70 : 15;
      const lateCutoff = absentCutoff + (dayOffset === 0 ? 10 : 20);

      let status: TurnstileIoStatus;
      if (roll < absentCutoff) status = "kelmagan";
      else if (roll < lateCutoff) status = "kechikkan";
      else status = "kelgan";

      if (status === "kelmagan") {
        rows.push({
          id,
          date: iso,
          personName: person.name,
          personType: person.type as TurnstileIoRecord["personType"],
          enterTime: null,
          exitTime: null,
          status,
        });
        return;
      }

      const enterHour = status === "kechikkan" ? 9 : 8;
      const enterMin = status === "kechikkan" ? rnd(5, 55) : rnd(10, 59);
      const exitHour = enterHour + rnd(7, 9);

      rows.push({
        id,
        date: iso,
        personName: person.name,
        personType: person.type as TurnstileIoRecord["personType"],
        enterTime: `${pad2(enterHour)}:${pad2(enterMin)}`,
        exitTime: `${pad2(Math.min(exitHour, 22))}:${pad2(rnd(0, 59))}`,
        status,
      });
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
  const col = db.collection("turnstile_io");
  await seedIfEmpty(col);
  const rows = await col.find({}).sort({ date: -1, id: 1 }).toArray();
  const records = rows.map(({ _id, ...rest }) => rest as unknown as TurnstileIoRecord);
  return NextResponse.json({ ok: true, records });
}
