import type { Db } from "mongodb";

// Xodim QAYSI FILIALLARDA ishlaydi — `hr_employees.branchIds`.
//
// NIMA UCHUN ALOHIDA MAYDON: `branchAssignments` (filial bo'yicha ish haqi)
// ni kalit sifatida ishlatib bo'lmaydi. O'lchandi: u to'ldirilgan 11
// xodimning 9 tasida `branchId: 3` ("Akademiya 3 Uychi") turgan, holbuki
// bazadagi butun ma'lumot 1-filialga tegishli — ya'ni u yerdagi filial
// oylik sozlagichida tanlangan qiymat, ish joyi emas.
//
// Navbardagi filial ro'yxati shu maydondan chiqadi (lib/branchScope.ts):
// xodim faqat o'ziga biriktirilgan filiallarni ko'radi va ular orasida
// almashadi. Admin bundan mustasno — u hammasini ko'radi.

/**
 * Mijozdan kelgan `branchIds` ni tozalaydi.
 *
 * `null` — maydon umuman berilmagan (chaqiruvchi o'zi sukut qiymat
 * tanlasin). Bo'sh massiv qaytmaydi: filialsiz xodim navbarda hech narsa
 * ko'rmasdi va butun saytdan uzilib qolardi.
 */
export async function sanitizeBranchIds(db: Db, raw: unknown): Promise<number[] | null> {
  if (!Array.isArray(raw)) return null;
  const rows = await db.collection("branches").find({}, { projection: { id: 1, _id: 0 } }).toArray();
  const valid = new Set(rows.map((r) => Number(r.id)).filter(Number.isFinite));
  const out = [...new Set(raw.map((x) => Number(x)).filter((n) => Number.isFinite(n) && valid.has(n)))];
  out.sort((a, b) => a - b);
  return out.length > 0 ? out : null;
}
