import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { pendingDiscountFor } from "@/lib/gamification/discounts";

// GET /api/gamification/discounts/pending?pupilId=…&month=YYYY-MM — Kassa →
// Kirim oynasi: o'quvchining shu oy to'loviga kutilayotgan tanga evaziga
// chegirmasi (TZ 4.16.4), kassir pulni olishdan OLDIN ko'rsin. Faqat
// ko'rsatish — qo'llash kirim yadrosida (lib/cashboxAdjust.ts). Ruxsat —
// Kirim oynasi turgan sahifaniki (scripts/gen-api-permissions.mjs).

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const pupilId = Number(sp.get("pupilId"));
  const month = sp.get("month") || "";
  if (!Number.isFinite(pupilId) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }
  const db = await ensureIndexes();
  const discount = await pendingDiscountFor(db, pupilId, month);
  return NextResponse.json({ ok: true, discount });
}
