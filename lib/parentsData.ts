import { STUDENTS_LIST } from "@/constants/studentsList";

// O'quvchilar → Ota-ona (crm-akademiya #view-parents, sidebar: O'quvchilar >
// Ota-ona, href /parents). Manbada bu sahifa o'zining seed massiviga ega
// emas — STUDENTS_LIST'ning o'zini indeks bo'yicha aylanib, har bir qatorga
// _prGetParents(index) orqali ota-ona ma'lumotini "yopishtiradi" (deterministik,
// lekin haqiqatan keshlanmaydi — har chaqiriqda qayta hisoblanadi). Shu
// yondashuvni saqlab qoldik: alohida "parents" massiv o'rniga shu funksiya.

export interface ParentInfo {
  fatherName: string;
  fatherPhone: string;
  motherName: string;
  motherPhone: string;
  fatherApp: boolean;
  motherApp: boolean;
}

export interface ParentRow {
  id: number;
  name: string;
  balance: number;
  moderator: string;
  father: string;
  fatherPhone: string;
  mother: string;
  motherPhone: string;
  fatherApp: boolean;
  motherApp: boolean;
}

const FATHER_NAMES = ["Akmal", "Bobur", "Davron", "Elyor", "Farrux", "Jasur", "Olim", "Rustam", "Sherzod", "Toxir", "Umid", "Zafar", "Aziz", "Dilshod", "Komil"];
const MOTHER_NAMES = ["Aziza", "Dilfuza", "Gulnora", "Kamola", "Lola", "Madina", "Nigora", "Oysha", "Saida", "Shahnoza", "Umida", "Zulayho", "Malika", "Rano", "Feruza"];
const PHONE_PREFIXES = ["93", "94", "97", "99", "90", "91", "88", "98", "77", "50", "95"];

function seededRnd(seedIn: number) {
  let seed = seedIn * 9301 + 49297;
  return (min: number, max: number) => {
    seed = (seed * 9301 + 49297) % 233280;
    return Math.floor((seed / 233280) * (max - min + 1)) + min;
  };
}

export function getParentInfo(index: number): ParentInfo {
  const rnd = seededRnd(index + 50000);
  const hasFather = rnd(0, 2) !== 2;
  const hasMother = rnd(0, 3) !== 3;
  const fatherName = hasFather ? `${FATHER_NAMES[rnd(0, FATHER_NAMES.length - 1)]} ota` : "";
  const fatherPhone = hasFather ? `${PHONE_PREFIXES[rnd(0, PHONE_PREFIXES.length - 1)]} ${rnd(100, 999)} ${rnd(10, 99)} ${rnd(10, 99)}` : "";
  const motherName = hasMother ? `${MOTHER_NAMES[rnd(0, MOTHER_NAMES.length - 1)]} ona` : "";
  const motherPhone = hasMother ? `${PHONE_PREFIXES[rnd(0, PHONE_PREFIXES.length - 1)]} ${rnd(200, 999)} ${rnd(10, 99)} ${rnd(10, 99)}` : "";
  const fatherApp = hasFather && rnd(0, 4) === 1;
  const motherApp = hasMother && rnd(0, 5) === 2;
  return { fatherName, fatherPhone, motherName, motherPhone, fatherApp, motherApp };
}

export function buildParentRows(): ParentRow[] {
  return STUDENTS_LIST.map((s: { id: number; name: string; balance: number; moderator: string }, i: number) => {
    const p = getParentInfo(i);
    return {
      id: s.id,
      name: s.name,
      balance: s.balance,
      moderator: s.moderator,
      father: p.fatherName,
      fatherPhone: p.fatherPhone,
      mother: p.motherName,
      motherPhone: p.motherPhone,
      fatherApp: p.fatherApp,
      motherApp: p.motherApp,
    };
  });
}

// "250 000 UZS" (bo'sh joy ajratkich + UZS) — balans 0 bo'lsa bo'sh qator
// (manbadagi _fmtBalanceUZS bilan bir xil, students-list'dagi fmtNum'dan farqli).
export function fmtBalanceUZS(n: number): string {
  if (!n) return "";
  const sign = n < 0 ? "-" : "";
  return `${sign}${Math.abs(n).toLocaleString("ru-RU").replace(/,/g, " ")} UZS`;
}
