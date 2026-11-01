import { groupExamMonth, type GroupExam } from "@/lib/imtihon";
import { pupilFullName, type Pupil } from "@/lib/pupilsData";
import type { StudentRow } from "@/lib/studentsData";
import { intOf, normHeader } from "./importUtils";

// IMTIHON → NATIJA KIRITISH: O'QUVCHILAR RO'YXATI YORDAMCHILARI — eski (GroupExamDrawer) va yangi
// (v2/imtihon/ExamEntryV2) panel uchun bitta qoida.
//
// GURUHSIZ RO'YXAT (01.11.2026, foydalanuvchi: «hali hammani guruhga joylamaganmiz … Markaz bo'yicha
// 1 ta ro'yxat qilish kerak … qaysi guruhda o'qiysiz demasin»; qoidalari lib/imtihon.ts da): ro'yxat
// guruhdan emas, qo'lda yig'iladi — o'quvchi ism/telefon bo'yicha qidirib tanlanadi, bazada yo'q
// bo'lsa karta ochiladi, Excel'dan yuklansa — butun filial bazasidan moslanadi.

/** Qidiruv natijasi → jadval qatori (jadval `Pupil` bilan ishlaydi; kerakligi — id, ism, telefon). */
export function pupilOfRow(s: Pick<StudentRow, "id" | "name" | "phone">): Pupil {
  return { id: s.id, firstName: s.name, lastName: "", phone: s.phone ?? "" } as unknown as Pupil;
}

/** Saqlangan sarhisobning o'quvchilari (tahrir rejimi) — ism/telefon sarhisobdagidek. */
export function rosterOfExam(exam: Pick<GroupExam, "students">): Pupil[] {
  return exam.students.map((s) => ({ id: s.pupilId, firstName: s.name, lastName: "", phone: s.phone }) as unknown as Pupil);
}

export interface PriorResult {
  exam: GroupExam;
  pct: number;
}

/**
 * Shu oy va fan bo'yicha BOSHQA sarhisoblardagi natija (arxivdagisiz; bir nechta bo'lsa — eng
 * oxirgisi): ro'yxatda «bu oyda bor» belgisi — bir o'quvchi ikki marta kiritilmasin. Ikkalasi
 * saqlansa reyting va o'quvchilar botida eng oxirgisi hisoblanadi (lib/examRanking.ts → rankPool).
 */
export function priorResults(exams: GroupExam[], month: string, course: string, skipId?: number): Map<number, PriorResult> {
  const out = new Map<number, PriorResult>();
  const want = course.trim().toLowerCase();
  if (!want) return out;
  const list = exams
    .filter((e) => e.id !== skipId && !e.archived && groupExamMonth(e) === month && e.course.trim().toLowerCase() === want)
    .sort((a, b) => a.id - b.id);
  for (const e of list) for (const s of e.students) out.set(s.pupilId, { exam: e, pct: s.pct });
  return out;
}

/* ---------------- Excel'dan yuklash ---------------- */

/** Ism solishtirish: apostrof turlari va bo'shliqlar farq qilmasin. */
export const normName = (s: string) =>
  s
    .toLowerCase()
    .replace(/[‘’ʻʼ`'"]/g, "")
    .replace(/\s+/g, " ")
    .trim();

export interface ResultColumns {
  /** Ism ustuni — bitta («O'quvchi», «F.I.Sh») yoki ikkita («Familiya» + «Ism»). */
  nameCols: number[];
  corrCol: number;
  /** Telefon ustuni; yo'q — -1. */
  phoneCol: number;
  /** Ma'lumot boshlanadigan qator. */
  start: number;
}

/**
 * Natijalar jadvalidagi ustunlar. Sarlavha (birinchi 5 qatordan): «O'quvchi/Ism/F.I.Sh» va «To'g'ri
 * javob/Ball»; sarlavhasiz fayl — ism harfli birinchi ustun, natija undan keyingi raqamli ustun.
 */
export function findResultColumns(table: string[][]): ResultColumns | null {
  for (let i = 0; i < Math.min(table.length, 5); i++) {
    // Nuqta («F.I.Sh.») va o'zbekcha tutuq belgilari («Oʻquvchi», «To‘g‘ri») ham tashlanadi.
    const h = table[i].map((x) => normHeader(x).replace(/[.ʻ‘]/g, ""));
    const n = h.findIndex((x) => /oquvchi|ism|fio|fish|familiya|name|student/.test(x));
    const c = h.findIndex((x) => /togri|javob|correct|ball|natija/.test(x));
    if (n < 0 || c < 0) continue;
    const fam = h.findIndex((x) => /familiya/.test(x));
    const ism = h.findIndex((x) => /^(ism|ismi|name|firstname)$/.test(x));
    return {
      nameCols: fam >= 0 && ism >= 0 && fam !== ism ? [fam, ism] : [n],
      corrCol: c,
      phoneCol: h.findIndex((x) => /telefon|phone|^tel/.test(x)),
      start: i + 1,
    };
  }
  for (const r of table) {
    const n = r.findIndex((x) => /\p{L}/u.test(String(x)));
    const c = n >= 0 ? r.findIndex((x, j) => j > n && /^\s*\d+\s*$/.test(String(x))) : -1;
    if (n >= 0 && c >= 0) return { nameCols: [n], corrCol: c, phoneCol: -1, start: 0 };
  }
  return null;
}

export interface ImportMatch {
  /** Topilganlar — fayl tartibida; bir o'quvchi ikki qatorda bo'lsa — keyingisi. */
  hits: { pupil: Pupil; correct: number }[];
  /** Bazada (guruhda) topilmagan ismlar. */
  missing: string[];
  /** Bir xil ismli bir nechta o'quvchi (telefon bilan ham ajralmadi) — qo'lda tanlanadi. */
  ambiguous: string[];
}

const phone9 = (s: unknown) => String(s ?? "").replace(/\D/g, "").slice(-9);

/**
 * Fayl qatorlari → o'quvchilar. GURUH rejimi (`strict: false`) — avvalgidek: ism guruh ro'yxatidan,
 * bir xil ism bo'lsa ro'yxatdagi keyingisi. GURUHSIZ (`strict: true`, butun filial bazasi): telefon
 * ustuni bo'lsa bir xil ismlilar telefon bilan ajratiladi (ism mos kelmasa telefonning o'zi bilan
 * ham topiladi), baribir bir nechta qolsa — `ambiguous` (taxmin bilan yozilmaydi).
 */
export function matchResultRows(table: string[][], cols: ResultColumns, pool: Pupil[], opts: { total: number; strict: boolean }): ImportMatch {
  const byName = new Map<string, Pupil[]>();
  const byPhone = new Map<string, Pupil[]>();
  const push = (m: Map<string, Pupil[]>, key: string, p: Pupil) => {
    if (!key) return;
    const list = m.get(key) ?? [];
    if (!list.some((x) => x.id === p.id)) list.push(p);
    m.set(key, list);
  };
  for (const p of pool) {
    push(byName, normName(pupilFullName(p)), p);
    push(byName, normName(`${p.lastName ?? ""} ${p.firstName ?? ""}`), p);
    const d = phone9(p.phone);
    if (d.length === 9) push(byPhone, d, p);
  }

  const hits = new Map<number, { pupil: Pupil; correct: number }>();
  const missing: string[] = [];
  const ambiguous: string[] = [];
  for (const r of table.slice(cols.start)) {
    const name = cols.nameCols
      .map((i) => String(r[i] ?? "").trim())
      .filter(Boolean)
      .join(" ");
    const raw = String(r[cols.corrCol] ?? "").trim();
    if (!name || raw === "") continue;
    let list = byName.get(normName(name)) ?? [];
    let p: Pupil | undefined;
    if (opts.strict) {
      const d = cols.phoneCol >= 0 ? phone9(r[cols.phoneCol]) : "";
      if (d.length === 9) {
        const same = list.filter((x) => phone9(x.phone) === d);
        if (same.length) list = same;
        else if (!list.length) list = byPhone.get(d) ?? [];
      }
      if (list.length === 1) p = list[0];
    } else {
      p = list[list.length - 1];
    }
    if (!p) {
      (list.length ? ambiguous : missing).push(name);
      continue;
    }
    let v = intOf(raw);
    if (opts.total > 0 && v > opts.total) v = opts.total;
    hits.delete(p.id);
    hits.set(p.id, { pupil: p, correct: v });
  }
  return { hits: [...hits.values()], missing, ambiguous };
}

/** Xabar uchun: birinchi uchta ism, qolgani «…». */
export function namesPreview(list: string[]): string {
  return list.slice(0, 3).join(", ") + (list.length > 3 ? "…" : "");
}
