export interface DavomatStudent {
  id: number;
  ident: string;
  name: string;
  phone: string;
  balance: number;
  group: string;
  teacher: string;
  moderator: string;
  reason: string;
  state: "attended" | "absent" | "late" | "excused";
}

/**
 * O'quvchi qoldirgan darslar soni — "Eng ko'p dars qoldirganlar bo'yicha"
 * saralash uchun (referensda shu nomli checkbox bor).
 *
 * DAVOMAT_STUDENTS statik demo ma'lumot va unda bunday maydon yo'q, shuning
 * uchun `id` dan DETERMINISTIK hisoblanadi — sahifa har ochilganda bir xil
 * tartib chiqadi. Backend haqiqiy sonni bergach, shu funksiya o'rniga o'sha
 * qiymat ishlatiladi.
 */
export function davomatMissedCount(id: number): number {
  return (id * 7) % 24;
}

export function formatDavomatBalance(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}${Math.abs(n).toLocaleString("ru-RU").replace(/,/g, " ")} so'm`;
}
