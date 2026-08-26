import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";

// GET /api/people/directory — ISM → PROFIL kartasi.
//
// Nima uchun kerak: CRM'ning ko'p jadvallarida odam faqat ISMI bilan
// saqlanadi, id'siz. Masalan `transaction_entries.moderator`,
// `groups.teacher`, `orders.teacher` — hammasi oddiy matn. Shu bois
// "ism ustiga bosilsa profil ochilsin" degan talab uchun klientda
// ism → id xaritasi kerak.
//
// Javob ATAYLAB juft-massiv ([id, ism]) ko'rinishida: 6700 o'quvchida
// {"id":1,"name":"..."} shakli ~2 barobar ko'p joy egallaydi. Katalog
// sessiyaga bir marta yuklanadi (components/shared/PersonDirectory.tsx),
// shuning uchun hajm muhim.
//
// Faqat id va ism qaytariladi — telefon, balans va boshqa shaxsiy
// ma'lumot bu yerga TUSHMAYDI, chunki katalog har sahifada yuklanadi.

export interface PeopleDirectoryResponse {
  ok: boolean;
  /** [id, ism] juftliklari — o'quvchilar (`pupils`). */
  students: [number, string][];
  /** [id, ism] juftliklari — xodimlar (`hr_employees`). */
  staff: [number, string][];
}

export async function GET() {
  const db = await ensureIndexes();

  const [pupilRows, staffRows] = await Promise.all([
    db.collection("pupils").find({}, { projection: { id: 1, firstName: 1, lastName: 1 } }).toArray(),
    db.collection("hr_employees").find({}, { projection: { id: 1, name: 1 } }).toArray(),
  ]);

  // O'quvchi ismi bazada ikki maydonga bo'lingan; jadvallarda esa
  // "Ism Familiya" ko'rinishida ko'rsatiladi (lib/studentsData.ts →
  // studentRowFromPupil bilan bir xil tartib), shuning uchun shu yerda ham
  // xuddi shunday birlashtiriladi — aks holda xarita hech qachon mos
  // kelmasdi.
  const students: [number, string][] = [];
  for (const p of pupilRows) {
    const name = `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim();
    if (name && typeof p.id === "number") students.push([p.id, name]);
  }

  const staff: [number, string][] = [];
  for (const e of staffRows) {
    const name = String(e.name ?? "").trim();
    if (name && typeof e.id === "number") staff.push([e.id, name]);
  }

  return NextResponse.json(
    { ok: true, students, staff } satisfies PeopleDirectoryResponse,
    {
      // Katalog sekin o'zgaradi (yangi o'quvchi/xodim qo'shilganda).
      // Brauzer 5 daqiqa o'z nusxasidan foydalanadi, keyin fon rejimida
      // yangilaydi — sahifalar orasida yurganda qayta so'rov ketmaydi.
      headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=3600" },
    },
  );
}
