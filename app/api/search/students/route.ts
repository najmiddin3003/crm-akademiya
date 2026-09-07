import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { getBranchScope, withPupilBranch } from "@/lib/branchScope";
import type { Pupil } from "@/lib/pupilsData";
import { phoneSearchPattern } from "@/lib/phoneSearch";
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

/** So'rovdagi maxsus belgilar regex sifatida talqin qilinmasin. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** `studentRecords()` (lib/search.ts) qidiradigan maydonlar. */
const FIELDS = ["firstName", "lastName", "phone", "moderator", "source", "category"] as const;

/**
 * Telefon uchun AJRATKICHGA CHIDAMLI naqsh — lib/phoneSearch.ts dan.
 *
 * NIMA NOTO'G'RI EDI: bazada raqam "94 155 88 55" ko'rinishida (6 797
 * o'quvchining hammasida shu format), qidiruv esa kiritilgan matnni
 * shundoq regexga aylantirardi. Ya'ni "941558855" deb yozilsa hech
 * narsa topilmasdi — bo'shliqlar to'sib qo'yardi.
 *
 * Qoida endi umumiy faylda: klient natijalarni QAYTA filtrlaydi
 * (lib/search.ts) va u yerdagi qoida bundan farq qilsa, server topgan
 * yozuv ekranga chiqmay qolardi — aynan shunday bo'lgan ham.
 */
const phonePattern = phoneSearchPattern;

/** O'quvchi ID si bo'yicha aniq moslik (masalan "16751"). */
function idClause(term: string): Record<string, unknown>[] {
  const asNum = Number(term);
  return Number.isInteger(asNum) && asNum > 0 ? [{ id: asNum }] : [];
}

const LIMIT = 20;

export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") || "").trim();
  // Bitta harf bo'yicha qidirish deyarli butun bazani qaytaradi — foydasi
  // yo'q, narxi bor.
  if (q.length < 2) return NextResponse.json({ ok: true, students: [] });

  // Ko'p so'z — HAMMASI mos kelishi kerak (klientdagi eski xulq bilan bir
  // xil): "ali valiyev" da "ali" ismga, "valiyev" familiyaga tushishi
  // mumkin, shuning uchun har bir so'z alohida $or bo'lib, ular $and ga
  // yig'iladi.
  // RAQAM KIRITILGANDA so'z bo'yicha bo'lish YARAMAYDI: "94 155 88 55"
  // to'rtta bo'lakka bo'linib, har biri ALOHIDA shart bo'lardi va
  // "94" hamma 94-raqamli o'quvchiga mos kelib ketardi. Shu bois raqamli
  // so'rov BUTUNLIGICHA, bitta naqsh sifatida qidiriladi.
  const wholePhone = phonePattern(q);
  const digitsOnly = /^[\d\s()+-]+$/.test(q);

  const terms = q.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 5);
  const and = digitsOnly && wholePhone
    ? [{ $or: [{ phone: { $regex: wholePhone } }, ...idClause(q)] }]
    : terms.map((t) => {
        const rx = { $regex: escapeRegex(t), $options: "i" };
        const or: Record<string, unknown>[] = FIELDS.map((f) => ({ [f]: rx }));
        // Aralash so'rovda ("ali 9415") raqamli bo'lak telefonga ham
        // urinib ko'rsin — ajratkichga chidamli naqsh bilan.
        const p = phonePattern(t);
        if (p) or.push({ phone: { $regex: p } });
        or.push(...idClause(t));
        return { $or: or };
      });

  // QIDIRUV HAM FILIAL BO'YICHA KESILADI — ro'yxat bilan bir xil qamrov
  // (sabab app/api/pupils/route.ts dagi GET izohida). Ikkalasi ajralib
  // qolsa qidiruv qamrovdagi eng katta teshik bo'lardi: ro'yxatda
  // ko'rinmaydigan o'quvchi ismini yozib topib olish mumkin edi.
  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });

  const db = await ensureIndexes();
  const rows = await db.collection("pupils")
    .find(withPupilBranch({ $and: and }, scope), {
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
