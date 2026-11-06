// XODIM ISH VAQTI (06.11.2026) — `hr_employees.workStart` / `workEnd`, "HH:MM" yoki null.
//
// Bitta xodimga bitta vaqt: kun bo'yicha farqi yo'q. Boshqaruv → «Ish jadvali»
// bilan aralashtirilmasin — u faqat nom (`scheduleId`), vaqti yo'q.
//
// Kiritiladigan joylar: Xodim qo'shish oynasi va «Ishga olish» (yangi xodimda majburiy, o'qituvchidan
// tashqari: unda hali guruh yo'q, vaqti keyin guruhidan olinadi — mijoz tekshiradi; server bo'shini
// qabul qiladi, Excel import va eski mijoz uchun),
// xodim kartasi, /vaqtinchalik → «Ish vaqtini belgilash» (hammasi bitta oynada; o'qituvchiga
// «Guruh vaqti bo'yicha» — lib/workTimeFromGroups.ts).
//
// Kechikishda faqat `workStart` ishlatiladi va faqat o'qituvchidan boshqa xodimga:
// o'qituvchi birinchi darsiga qarab o'lchanadi (lib/attendanceCheck.ts → expectationFor).
//
// Sof modul: brauzerda ham, serverda ham shu qoida. Tungi smena yo'q (06.11 o'lchandi:
// xodimlar o'qituvchi, moderator, IT), shu bois tugash boshlanishdan keyin bo'lishi shart —
// «18:00 – 09:00» kabi almashib ketgan yozuv ushlansin.

const HM = /^([01]\d|2[0-3]):[0-5]\d$/;

export type WorkTimeResult =
  | { ok: true; workStart: string | null; workEnd: string | null }
  | { ok: false; error: string };

/** Ikkalasi bo'sh — «kiritilmagan» (null); bittasi bo'sh bo'lishi mumkin emas. */
export function parseWorkTime(start: unknown, end: unknown): WorkTimeResult {
  const s = typeof start === "string" ? start.trim() : "";
  const e = typeof end === "string" ? end.trim() : "";
  if (!s && !e) return { ok: true, workStart: null, workEnd: null };
  if (!s || !e) return { ok: false, error: "Ish vaqtining boshi va oxirini kiriting" };
  if (!HM.test(s) || !HM.test(e)) return { ok: false, error: "Ish vaqti noto'g'ri — masalan 09:00" };
  if (e <= s) return { ok: false, error: "Ish tugash vaqti boshlanishidan keyin bo'lsin" };
  return { ok: true, workStart: s, workEnd: e };
}

/** «09:00 – 18:00»; kiritilmagan bo'lsa bo'sh satr. */
export function workTimeLabel(e: { workStart?: string | null; workEnd?: string | null }): string {
  return e.workStart && e.workEnd ? `${e.workStart} – ${e.workEnd}` : "";
}
