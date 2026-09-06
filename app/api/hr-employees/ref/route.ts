import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";

// GET /api/hr-employees/ref — XODIMLARNING SHAXSIY KARTOTEKASI.
//
// FILIAL BO'YICHA KESILMAYDI, lekin PROYEKSIYASI QAT'IY TOR.
//
// ══════════════════════════════════════════════════════════════════
// NIMA UCHUN KERAK
//
// `/api/hr-employees` endi filialga kesiladi. Lekin butun kompaniya
// ro'yxatiga tayanadigan ekranlar bor va ularni kesish ZARARLI:
//
//   • Tug'ilgan kunlar — markaz butun jamoani ko'radi, filialga
//     bo'lish bu sahifaning ma'nosini yo'qotadi;
//   • Rollar sahifasi — rollar TIZIM SOZLAMASI, filialsiz
//     (lib/branchScope.ts dagi kelishilgan qaror);
//   • Oylik foizlari sozlamasidagi "nechta xodim" hisoblagichi;
//   • Oylik chiqarish TARIXI va kassa jurnali — u yerdagi ism→id
//     xaritasi ESKI yozuvlar uchun; boshqa filialga o'tgan xodimning
//     cheki "topilmadi" bo'lib qolmasligi kerak;
//   • Kassa oynalari (bonus, jarima, chiqim) — kassalar ATAYLAB
//     filialsiz (app/api/cashboxes/route.ts), ya'ni xodim ro'yxatini
//     kesib kassa ro'yxatini kesmaslik noizchil holat bo'lardi.
//
// ══════════════════════════════════════════════════════════════════
// NIMA UCHUN `?scope=all` BAYROG'I EMAS
//
// U "oylikni ko'radigan har kim butun kompaniya ro'yxatini TO'LIQ
// oladi" degani bo'lardi — telefon, oklad, `branchAssignments`,
// `taxIds`, `plastikSalary` bilan birga. Tor proyeksiya bu regressiyani
// yopadi: kesishni yumshatish "hammasini ko'rish" ga aylanadi,
// "hamma narsasini ko'rish" ga emas.
//
// QOIDA BIR JUMLADA: ref = SHAXS, pul yoki filial emas.
//
// ⚠ Yangi maydon qo'shishdan oldin shu qoidaga solishtiring. Chiqmaydi:
//   branchIds, payrollBranchId, branchAssignments, taxIds,
//   plastikSalary, filial, email, comment, customFields.
const PROJECTION = {
  _id: 0,
  id: 1,
  name: 1,
  turi: 1,
  archReason: 1,
  phone: 1,
  // `percent` — DARAJA NOMI ("Yashil"), summa emas. Oylik foizlari
  // sozlamasidagi hisoblagich shuni sanaydi.
  percent: 1,
  // Rollar sahifasi xodimga alohida ruxsat qo'yilganini ko'rsatadi.
  permissions: 1,
  birthDate: 1,
  photoUrl: 1,
} as const;

export async function GET() {
  const db = await ensureIndexes();
  const rows = await db.collection("hr_employees").find({}).project(PROJECTION).sort({ id: 1 }).toArray();
  // `archDate`/`archReason` yo'q eski hujjatlar uchun bo'sh satr —
  // ro'yxat route'idagi bilan bir xil kelishuv.
  const employees = rows.map((r) => ({ archReason: "", ...r }));
  return NextResponse.json({ ok: true, employees });
}
