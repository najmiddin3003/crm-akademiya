import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { getBranchScope, withPupilBranch } from "@/lib/branchScope";
import type { Pupil } from "@/lib/pupilsData";
import { pupilSearchFilter } from "@/lib/pupilSearch";
import { studentRowFromPupil } from "@/lib/studentsData";

// GET /api/search/students?q=… — navbardagi global qidiruv uchun.
//
// NEGA KERAK: ilgari Navbar `useStudents()` orqali BUTUN o'quvchilar
// ro'yxatini yuklardi — 6 732 hujjat, ~3.6 MB — va faqat qidiruv oynasi
// uchun. Navbar `AppShell` ichida, ya'ni bu HAR BIR sahifa ochilishida
// takrorlanardi. Endi sahifa ochilishida hech narsa yuklanmaydi, so'rov
// faqat foydalanuvchi yozganda ketadi va bir necha kilobayt qaytadi.
//
// Qidiruv SERVERDA bajariladi: 6 732 hujjatni brauzerga tashib, u yerda
// filtrlashning ma'nosi yo'q edi.
//
// FILTRNING O'ZI lib/pupilSearch.ts da — xodimlar Telegram boti ham
// aynan o'sha qoida bilan qidiradi. Bu yerda faqat filial qamrovi va
// javob shakli.

const LIMIT = 20;

export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") || "").trim();
  // Bitta harf bo'yicha qidirish deyarli butun bazani qaytaradi — foydasi
  // yo'q, narxi bor.
  const filter = pupilSearchFilter(q);
  if (!filter) return NextResponse.json({ ok: true, students: [] });

  // QIDIRUV HAM FILIAL BO'YICHA KESILADI — ro'yxat bilan bir xil qamrov
  // (sabab app/api/pupils/route.ts dagi GET izohida). Ikkalasi ajralib
  // qolsa qidiruv qamrovdagi eng katta teshik bo'lardi: ro'yxatda
  // ko'rinmaydigan o'quvchi ismini yozib topib olish mumkin edi.
  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });

  const db = await ensureIndexes();
  const rows = await db.collection("pupils")
    .find(withPupilBranch(filter, scope), {
      // Faqat StudentRow uchun kerak bo'lgan maydonlar.
      projection: {
        _id: 0, id: 1, firstName: 1, lastName: 1, phone: 1, balance: 1, coin: 1,
        createdAt: 1, moderator: 1, source: 1, category: 1,
        status: 1, statusReason: 1, statusChangedAt: 1,
      },
    })
    .limit(LIMIT)
    .toArray();

  const students = rows.map((r) => studentRowFromPupil(r as unknown as Pupil));
  return NextResponse.json({ ok: true, students });
}
