// FILIAL HOVUZLARI — bitta hovuzdagi filiallar KASSA va OYLIKDAN BOSHQA
// hamma joyda BITTA filialdek ko'rinadi (qaror 09.10.2026, foydalanuvchi:
// «2 ta filialni kassasidan boshqa hamma yerni bitta qilishimiz kerak»;
// oylik ham filial bo'yicha qoladi — o'sha kuni tanlangan).
//
// «Akademiya 1 Chortoq» va «Akademiya 2 Chortoq» — bitta shahardagi ikki
// bino: o'quvchilar, guruhlar, xonalar, lidlar, o'qituvchilar, jadval,
// hisobotlar va KPI ikkalasida bir xil. 07.09.2026 dan bu hovuz faqat
// o'quvchilar uchun edi (PUPIL_BRANCH_POOLS, lib/branchScope.ts).
//
// MA'LUMOT KO'CHIRILMAYDI: har yozuv o'z `branchId` si bilan qoladi, faqat
// O'QISH sharti hovuzni oladi (lib/branchScope.ts → `branchCondition`).
// Ya'ni qaytarish oson — ro'yxatdan hovuzni olib tashlash yetadi.
//
// QAT'IY (hovuzsiz) QOLADIGANLAR — `strictBranchCondition` /
// `strictScopedEmployeeFilter`:
//   • kassa — u filialga emas, mas'ul shaxsga qarab kesiladi (GET /api/cashboxes);
//   • oylik — `payrollBranchId`, oy qulfi va yopish filial bo'yicha
//     (app/api/salary-runs/*, lib/ai/tools/payroll.ts), xodimlar balansi hisoboti;
//   • xodim davomati (QR / turniket) — jismoniy bino va uning ish vaqti.
//
// Bu fayl SERVERGA BOG'LIQ EMAS (cookie/baza yo'q) — mijoz komponentlari
// ham shu qoidadan foydalanadi (Xonalar ro'yxati, lid → guruh tanlovi).
// Yangi filial qo'shilsa yoki hovuz o'zgarsa — faqat shu ro'yxat.

export const BRANCH_POOLS: readonly (readonly number[])[] = [[1, 2]];

/** Filial → u qatnashadigan hovuz (yo'q bo'lsa — o'zi yolg'iz). */
export function branchPool(branchId: number): readonly number[] {
  return BRANCH_POOLS.find((p) => p.includes(branchId)) ?? [branchId];
}

/** Ikki filial bitta hovuzdami (bir xil filial ham — ha). */
export function sameBranchPool(a: number, b: number): boolean {
  return a === b || branchPool(a).includes(b);
}

/** Filiallar ro'yxatini hovuzlari bilan kengaytiradi (takrorsiz, tartib saqlanadi). */
export function expandBranchPools(ids: readonly number[]): number[] {
  const out: number[] = [];
  for (const id of ids) for (const b of branchPool(id)) if (!out.includes(b)) out.push(b);
  return out;
}
