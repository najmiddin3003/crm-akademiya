import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { listSourceOptions } from "@/lib/studentSources";

// GET /api/student-sources/options — "Manba" tanlovlari ro'yxati.
//
// FAQAT O'QISH — ATAYLAB. Bu route o'quvchi qo'shish oynasi turgan HAR BIR
// sahifadan chaqiriladi (/orders-list, /students-list, /groups …), ruxsatlar
// jadvali esa route'ni SAHIFAGA bog'laydi va metod darajasida ajratmaydi
// (scripts/gen-api-permissions.mjs). Ya'ni bu yerga POST qo'yilsa, o'quvchi
// qo'sha oladigan har bir xodim ro'yxatni ham o'zgartira olardi.
//
// O'zgartirish esa qo'shni route'da: /api/student-sources/options/manage —
// uni faqat O'quvchilar oqimi sahifasidagi boshqaruv oynasi chaqiradi.
export async function GET() {
  const db = await ensureIndexes();
  return NextResponse.json({ ok: true, options: await listSourceOptions(db) });
}
