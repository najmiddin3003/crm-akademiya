import type { Filter, Document } from "mongodb";
import { phoneSearchPattern } from "@/lib/phoneSearch";

// O'QUVCHI QIDIRUVINING MONGO FILTRI — yagona qoida.
//
// NEGA ALOHIDA FAYL. Bir xil qidiruv ikki joyda kerak: navbardagi global
// qidiruv (app/api/search/students) va xodimlar Telegram botidagi
// "O'quvchini tanlang" qadami (lib/staffBot). Ilgari filtr route'ning
// ichida edi; botga nusxa ko'chirilsa ikkalasi vaqt o'tib ajralib ketardi
// — telefon naqshi bilan aynan shunday bo'lgan (lib/phoneSearch.ts
// izohiga qarang). Endi ikkalasi shu funksiyadan boshlanadi; filial
// qamrovini har biri O'ZI qo'shadi (`withPupilBranch`), chunki web'da u
// cookie'dan, botda esa kassaning filialidan keladi.

/** So'rovdagi maxsus belgilar regex sifatida talqin qilinmasin. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** `studentRecords()` (lib/search.ts) qidiradigan maydonlar. */
const FIELDS = ["firstName", "lastName", "phone", "moderator", "source", "category"] as const;

/** O'quvchi ID si bo'yicha aniq moslik (masalan "16751"). */
function idClause(term: string): Record<string, unknown>[] {
  const asNum = Number(term);
  return Number.isInteger(asNum) && asNum > 0 ? [{ id: asNum }] : [];
}

/** Shundan qisqa so'rov qidirilmaydi — bitta harf deyarli butun bazani qaytaradi. */
export const MIN_QUERY = 2;

/**
 * Qidiruv matnidan Mongo filtri. `null` — qidirishga arzimaydi (qisqa).
 *
 * Ko'p so'z — HAMMASI mos kelishi kerak (klientdagi eski xulq bilan bir
 * xil): "ali valiyev" da "ali" ismga, "valiyev" familiyaga tushishi
 * mumkin, shuning uchun har bir so'z alohida $or bo'lib, ular $and ga
 * yig'iladi.
 *
 * RAQAM KIRITILGANDA so'z bo'yicha bo'lish YARAMAYDI: "94 155 88 55"
 * to'rtta bo'lakka bo'linib, har biri ALOHIDA shart bo'lardi va "94"
 * hamma 94-raqamli o'quvchiga mos kelib ketardi. Shu bois raqamli so'rov
 * BUTUNLIGICHA, bitta naqsh sifatida qidiriladi.
 *
 * Telefon uchun AJRATKICHGA CHIDAMLI naqsh — lib/phoneSearch.ts dan.
 * Bazada raqam "94 155 88 55" ko'rinishida (6 797 o'quvchining hammasida
 * shu format); oddiy regex bilan "941558855" hech narsa topmasdi.
 */
export function pupilSearchFilter(query: string): Filter<Document> | null {
  const q = query.trim();
  if (q.length < MIN_QUERY) return null;

  const wholePhone = phoneSearchPattern(q);
  const digitsOnly = /^[\d\s()+-]+$/.test(q);

  const terms = q.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 5);
  const and = digitsOnly && wholePhone
    ? [{ $or: [{ phone: { $regex: wholePhone } }, ...idClause(q)] }]
    : terms.map((t) => {
        const rx = { $regex: escapeRegex(t), $options: "i" };
        const or: Record<string, unknown>[] = FIELDS.map((f) => ({ [f]: rx }));
        // Aralash so'rovda ("ali 9415") raqamli bo'lak telefonga ham
        // urinib ko'rsin — ajratkichga chidamli naqsh bilan.
        const p = phoneSearchPattern(t);
        if (p) or.push({ phone: { $regex: p } });
        or.push(...idClause(t));
        return { $or: or };
      });

  return { $and: and };
}
