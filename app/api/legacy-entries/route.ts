import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { LEGACY_COLLECTION, type LegacyEntry } from "@/lib/legacyEntries";

// GET /api/legacy-entries?pupilId=<n> — o'quvchining EDUTIZIMDAGI eski
// to'lov tarixi (o'quvchi profilidagi "Tranzaksiyalar tarixi" uchun).
//
// FAQAT O'QISH. Bu route'da POST/PATCH/DELETE ATAYLAB YO'Q: arxiv —
// muzlatilgan tarix, uni CRM ichidan o'zgartirish ma'nosiz va xavfli
// bo'lardi. Yozish faqat bir martalik skript orqali
// (scripts/import-legacy-entries.mjs).
//
// PUL HISOBIGA UMUMAN QO'SHILMAYDI. Bu yozuvlar alohida kolleksiyada
// yotadi va ularni boshqa hech bir so'rov ko'rmaydi — kassa balansi,
// o'quvchi balansi, o'qituvchi oyligi, hisobotlar, Google Sheets va
// Telegram hammasi `transaction_entries` bilan ishlaydi. Sabab batafsil
// lib/legacyEntries.ts da.
//
// O'QUVCHI ID BO'YICHA, ISM BO'YICHA EMAS. Jonli tarix ism bo'yicha
// so'raladi (StudentEditPage) va bu ma'lum kamchilik — bazada 511 ta
// ism takrorlanadi. Arxivda esa har bir yozuvga ko'chirish paytida
// TELEFON orqali topilgan `pupilId` yozib qo'yilgan, shu bois bu yerda
// o'sha xato takrorlanmaydi.

/** Bitta o'quvchi uchun eng ko'p qator. Amalda eng ko'pi ~120 ta. */
const LIMIT = 500;

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("pupilId");
  const pupilId = Number(raw);
  if (!raw || !Number.isInteger(pupilId) || pupilId <= 0) {
    return NextResponse.json({ ok: false, error: "pupilId kerak" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const rows = await db
    .collection(LEGACY_COLLECTION)
    .find({ pupilId }, { projection: { _id: 0 } })
    .sort({ at: -1 })
    .limit(LIMIT)
    .toArray();

  return NextResponse.json({ ok: true, entries: rows as unknown as LegacyEntry[] });
}
