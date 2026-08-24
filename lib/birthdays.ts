// Navbardagi "Tug'ilgan kunlar" (href /birthdays).
//
// ILGARI NIMA NOTO'G'RI EDI: bu fayl har bir odamning tug'ilgan sanasini
// YOZUV ID'SIDAN XESHLAB o'ylab topardi — `id * 2654435761`, so'ng oy/kun/yil
// qoldiqlardan olinardi. Odamlarning o'zi ham haqiqiy emas edi: o'quvchilar
// lib/ordersData.ts dagi demo buyurtma generatoridan, xodimlar esa statik
// constants/employees.js massividan kelardi. Ya'ni kalendardagi har bir
// katak yolg'on edi va u yerdagi "tug'ilgan kun" hech kimning haqiqiy
// tug'ilgan kuni emasdi.
//
// ENDI: ikkala to'plamda ham HAQIQIY `birthDate` maydoni bor va u faqat
// shundan o'qiladi:
//   • o'quvchilar — pupils.birthDate (lib/pupilsData.ts; o'quvchi profilidagi
//     "Tahrirlash" tabi va "O'quvchi qo'shish" modali saqlaydi);
//   • xodimlar — hr_employees.birthDate (components/employees/employeeExtras.ts;
//     "Xodim qo'shish" modali saqlaydi, POST /api/hr-employees tekshiradi).
// Ikkalasi ham "YYYY-MM-DD" ko'rinishida saqlanadi.
//
// Sanasi kiritilmagan odam ro'yxatga UMUMAN kirmaydi — sanani taxmin qilish
// yoki "01.01" qo'yish soxta ma'lumot bo'lardi.

export type PersonKind = "student" | "employee";

export interface BirthdayPerson {
  id: number;
  name: string;
  phone: string;
  kind: PersonKind;
  /** 1..12 */
  month: number;
  /** 1..31 */
  day: number;
  year: number;
}

/** Faqat kerakli maydonlar — chaqiruvchi to'liq Pupil/HrEmployee uzatishi mumkin. */
export interface BirthdaySource {
  id: number;
  name: string;
  phone?: string;
  /** "YYYY-MM-DD" yoki bo'sh/aniqlanmagan. */
  birthDate?: string;
}

/**
 * "YYYY-MM-DD" → { year, month, day }. Format buzilgan yoki sana mavjud
 * bo'lmagan bo'lsa (masalan "2011-02-30") — null, ya'ni qator chiqmaydi.
 */
function parseIsoBirth(raw: string | undefined): { year: number; month: number; day: number } | null {
  const m = (raw ?? "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1) return null;
  // Oyning haqiqiy kun soni (kabisa yili hisobga olinadi).
  if (day > new Date(year, month, 0).getDate()) return null;
  return { year, month, day };
}

/**
 * O'quvchilar + xodimlardan tug'ilgan kunlar ro'yxati.
 * Kesh YO'Q: ilgari natija modul darajasida keshlanardi (chunki u
 * generatordan kelardi), endi ma'lumot bazadan keladi va har safar yangi.
 */
export function buildBirthdays(pupils: BirthdaySource[], employees: BirthdaySource[]): BirthdayPerson[] {
  const out: BirthdayPerson[] = [];
  const add = (rows: BirthdaySource[], kind: PersonKind) => {
    for (const r of rows) {
      const name = (r.name ?? "").trim();
      if (!name) continue;
      const birth = parseIsoBirth(r.birthDate);
      // Sanasi yo'q odam kalendarda ko'rinmaydi — o'ylab topilmaydi.
      if (!birth) continue;
      out.push({ id: r.id, name, phone: (r.phone ?? "").trim(), kind, ...birth });
    }
  };
  add(pupils, "student");
  add(employees, "employee");
  return out;
}

export function filterByKind(rows: BirthdayPerson[], kind: PersonKind | "all"): BirthdayPerson[] {
  return kind === "all" ? rows : rows.filter((r) => r.kind === kind);
}

/** Berilgan oyning har bir kuni uchun ro'yxat (kalit — kun raqami). */
export function byDay(rows: BirthdayPerson[], month: number): Map<number, BirthdayPerson[]> {
  const out = new Map<number, BirthdayPerson[]>();
  for (const r of rows) {
    if (r.month !== month) continue;
    const list = out.get(r.day);
    if (list) list.push(r);
    else out.set(r.day, [r]);
  }
  for (const list of out.values()) list.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

/** Yillik ko'rinish uchun: har bir oyga tegishli odamlar. */
export function byMonth(rows: BirthdayPerson[]): BirthdayPerson[][] {
  const out: BirthdayPerson[][] = Array.from({ length: 12 }, () => []);
  for (const r of rows) out[r.month - 1].push(r);
  for (const list of out) list.sort((a, b) => a.day - b.day || a.name.localeCompare(b.name));
  return out;
}

/**
 * Oyning 1-kuni haftaning nechanchi kuniga to'g'ri kelishi — DUSHANBADAN
 * boshlab (0 = dushanba). Kalendar to'rida oldingi bo'sh kataklar shundan.
 */
export function firstWeekdayOffset(year: number, month: number): number {
  const js = new Date(year, month - 1, 1).getDay(); // 0 = yakshanba
  return (js + 6) % 7;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}
