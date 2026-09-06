import type { HrEmployee } from "@/lib/hrEmployees";

// Sozlamalar â Moliya â Oylik foizlari jadvalidagi "Bog'langan xodim soni"
// ustunining HAQIQIY manbasi.
//
// Bog'lanish rost: xodim kartochkasida ("Boshqaruv â Xodimlar", HrEmployee
// `percent` maydoni) foizning RAQAMI emas, DARAJA NOMI saqlanadi â "Yashil",
// "Sariq" va h.k. Oylik hisoblashda lib/payrollSources.ts aynan shu nomni shu
// ro'yxatdan qidiradi (loadPercentByTier / resolvePercent). Ya'ni "bu darajaga
// nechta xodim bog'langan" degan savolning javobi bazada bor.
//
// Ilgari bu ustun yozuvning ichidagi `staffCount` maydonidan o'qirdi, uni esa
// hech qanday kod yangilamasdi â jadvalda seed'dan kelgan 14 / 9 / 7 kabi
// o'ylab topilgan sonlar turardi. Endi har ochilganda /api/hr-employees dan
// qayta sanaladi.

/** Solishtirish kaliti â katta-kichik harf va ortiqcha bo'shliq farq qilmasin. */
function nameKey(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}

/**
 * Daraja nomi (kichik harfda) â shu darajaga biriktirilgan xodimlar soni.
 *
 * Arxivdagi xodimlar ham sanaladi: oylik hisobida ular ham shu foiz bo'yicha
 * ko'riladi (lib/payrollSources.ts barcha `hr_employees` qatorlarini oladi),
 * shuning uchun bu yerda filtrlash ikki ekranda ikki xil son berardi.
 *
 * Modul darajasidagi barqaror funksiya â SettingsListTab uni useEffect
 * bog'lanishida ishlatadi, har renderda yangi havola bo'lsa cheksiz sikl
 * bo'lardi.
 */
export async function loadMonthlyPercentStaffCounts(): Promise<Map<string, number>> {
  // FILIALGA KESILMAGAN ro'yxat (tor proyeksiya) — nima uchun aynan
  // shu endpoint: app/api/hr-employees/ref/route.ts izohiga qarang.
  const res = await fetch("/api/hr-employees/ref");
  const data = await res.json();
  if (!data?.ok) throw new Error(data?.error || "Xodimlar ro'yxati olinmadi");

  const counts = new Map<string, number>();
  for (const emp of data.employees as HrEmployee[]) {
    const tier = nameKey(emp.percent);
    // Foizi belgilanmagan xodim hech bir darajaga bog'lanmagan.
    if (!tier) continue;
    counts.set(tier, (counts.get(tier) ?? 0) + 1);
  }
  return counts;
}
