// O'quvchilar — MongoDB'dagi "pupils" kolleksiyasi. Bu loyihadagi
// o'quvchilarning YAGONA manbasi: "O'quvchi qo'shish" (AddStudentModal) orqali
// qo'shilganlar ham, scripts/seed-test-pupils.js bilan bazaga yozilgan test
// o'quvchilar ham shu yerda. Ilgari yonida constants/index.js (STUDENTS, 50 ta)
// va constants/studentsList.js (STUDENTS_LIST, 5909 ta) statik demo ro'yxatlari
// turardi — ular olib tashlandi, endi hamma joy /api/pupils dan o'qiydi.

export interface Pupil {
  id: number;
  firstName: string;
  lastName: string;
  phone: string;
  extraPhone: string;
  category: string;
  birthDate: string;
  createdAt: string;
  /** Balans (UZS) — manfiy bo'lsa qarzdor. Yangi o'quvchida 0. */
  balance?: number;
  /** Gamifikatsiya koinlari. Yangi o'quvchida 0. */
  coin?: number;
  /** O'quvchini olib borayotgan moderator. */
  moderator?: string;
  /** Qayerdan keldi (Instagram, Telegram, Tavsiya...). */
  source?: string;
}

export interface NewPupilValues {
  firstName: string;
  lastName: string;
  phone: string;
  extraPhone: string;
  category: string;
  birthDate: string;
}

/** "Ism Familiya" — ro'yxat/tanlov joylarida o'quvchining ko'rinadigan nomi. */
export function pupilFullName(p: Pick<Pupil, "firstName" | "lastName">): string {
  return `${p.firstName} ${p.lastName}`.trim();
}

export function buildPupilFromValues(nextId: number, values: NewPupilValues): Pupil {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const createdAt = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()} | ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  // balance/coin/moderator/source qo'shish formasida so'ralmaydi — nol/bo'sh
  // holatda boshlanadi, keyin moliya amallari (bonus/jarima/to'lov) o'zgartiradi.
  return { id: nextId, ...values, createdAt, balance: 0, coin: 0, moderator: "", source: "" };
}
