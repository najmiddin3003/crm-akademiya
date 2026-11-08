import { branchPool } from "@/lib/branchPools";
import { findCourseByName } from "@/lib/courseLevels";

// Guruhning OYLIK narxi — kurs (va daraja) narxidan, filial bo'yicha. Qarzdorlar
// hisoboti (lib/debtors.ts) va yangi versiyadagi «Keldi → guruhga qo'shildi»
// oynasi (components/v2/first-lessons) bitta qoidani o'qisin deb alohida faylda:
// bu fayl `mongodb` ni import qilmaydi — mijoz ham, server ham o'qiydi.

const norm = (s: string | undefined | null) => String(s ?? "").trim().toLowerCase();

/**
 * `offline_courses` hujjatining narx uchun kerak bo'lgan qismi
 * (components/offline-courses/OfflineCoursesProvider.tsx → OfflineCourse
 * bilan bir xil maydonlar). O'sha tip ATAYLAB import qilinmaydi:
 * scripts/gen-api-permissions.mjs importlarni kuzatib, Provider ichidagi
 * "/api/offline-courses" havolalarini /reports-unpaid sahifasiga ham
 * ochib yuborardi (kurs yaratish/o'chirish API'si hisobot ruxsati bilan).
 */
export interface PricedCourse {
  name: string;
  branches?: { id: number; enabled: boolean; price: number }[];
  levels?: { name: string; branches?: { id: number; enabled: boolean; summa: number }[] }[];
}

/**
 * Oylik narx bundan kichik bo'lishi mumkin emas (ro'yxatdagi eng pasti
 * 280 000). Kichigi — eski "bitta dars narxi" (21 538 kabi) qolib ketgan
 * hujjat: uni oylik deb olsak qarz 13 barobar kam chiqardi. Shunday qiymat
 * "narx kiritilmagan" deb olinadi — sahifada ogohlantirish chiqadi,
 * scripts/set-course-prices.mjs qayta yurgiziladi.
 */
const MIN_MONTHLY_PRICE = 50_000;

/**
 * Guruh uchun OYLIK narx (yuqoridagi qoida). `null` — topilmadi.
 *
 * Musbat bo'lmagan narx (0) "kiritilmagan" deb olinadi: kurs formasi
 * o'chirilgan filialga ham `price: 0` yozadi.
 */
export function monthlyPriceFor(
  group: { course?: string; level?: string; branchId?: number | null },
  courses: PricedCourse[],
): number | null {
  const course = findCourseByName(courses, group.course || "");
  if (!course) return null;
  // Maydoni yo'q eski guruh 1-filialniki (lib/branchScope.ts → branchCondition).
  const branchId = Number(group.branchId) || 1;
  // 1+2 HOVUZI (09.10.2026, lib/branchPools.ts): guruhning `branchId` si —
  // uni yaratgan navbar filiali, bino emas. Avval o'z filiali qatori, u
  // yo'q yoki o'chiq bo'lsa — hovuzdosh filial qatori. Aks holda bir xil
  // kursdagi umumiy ro'yxat guruhlari jimgina kurs asosiy narxiga tushardi.
  const order = [branchId, ...branchPool(branchId).filter((b) => b !== branchId)];

  const levelKey = norm(group.level);
  if (levelKey) {
    const level = (course.levels ?? []).find((l) => norm(l.name) === levelKey);
    for (const bid of order) {
      const lb = level?.branches?.find((b) => Number(b.id) === bid && b.enabled);
      if (lb && Number(lb.summa) >= MIN_MONTHLY_PRICE) return Number(lb.summa);
    }
  }
  for (const bid of order) {
    const cb = (course.branches ?? []).find((b) => Number(b.id) === bid && b.enabled);
    if (cb && Number(cb.price) >= MIN_MONTHLY_PRICE) return Number(cb.price);
  }
  return null;
}
