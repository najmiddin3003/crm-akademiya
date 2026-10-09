import type { Db, Document, Filter } from "mongodb";
import type { BranchScope } from "@/lib/branchScope";
import { branchPool } from "@/lib/branchPools";
import type { EmployeeBranchAssignment } from "@/lib/hrEmployees";

// XODIM VA FILIAL — ikkita ALOHIDA savol, ikkita alohida maydon.
//
// ┌─ KO'RINISH ── `branchIds: number[]` ────────────────────────────────┐
// │ Xodim QAYSI FILIALLARDA ishlaydi. Ko'p qiymatli: Chortoq 1 va 2 da │
// │ dars beradigan o'qituvchi IKKALA filial ro'yxatida ham chiqadi.    │
// │ Navbardagi filial tanlagichi ham shundan (lib/branchScope.ts).      │
// └────────────────────────────────────────────────────────────────────┘
// ┌─ PUL ── `payrollBranchId: number` ──────────────────────────────────┐
// │ Oylik QAYSI FILIALDAN chiqadi. Aynan BITTA qiymat.                 │
// │                                                                     │
// │ NIMA UCHUN ALOHIDA: oylik ro'yxati `branchIds` bo'yicha kesilsa,   │
// │ [1,2] xodim IKKALA filialning ro'yxatida TO'LIQ summa bilan turadi │
// │ va ikki admin uni ikki marta to'lashi mumkin. Kassadagi qorovul     │
// │ ($gte) buni ushlamaydi — u faqat mablag' yetarliligini qaraydi.     │
// │ `payrollBranchId` bilan xodim ikkinchi ro'yxatda UMUMAN            │
// │ KO'RINMAYDI: ikki marta to'lash arifmetika bilan emas, TO'PLAM     │
// │ BO'LINISHI bilan yopiladi.                                          │
// └────────────────────────────────────────────────────────────────────┘
//
// `branchAssignments` — UCHINCHI narsa: filial bo'yicha ish haqi/rol/jadval.
// A'zolik EMAS. O'lchandi — u to'ldirilgan 13 xodimning 5 tasida
// `branchId` xodimning haqiqiy filialiga mos kelmaydi (masalan Chortoqda
// ishlaydigan odamda Uychi qatori turibdi).

/**
 * Mijozdan kelgan `branchIds` ni tekshiradi.
 *
 * ESKI `sanitizeBranchIds` DAN FARQI: u JIMGINA tozalardi — noto'g'ri id
 * tashlanardi, bo'sh natijada `null` qaytarardi va chaqiruvchi maydonni
 * umuman yozmasdi. Ya'ni foydalanuvchi hamma galochkani olib tashlab
 * "saqlandi" xabarini ko'rardi, baza esa eski holida qolardi. Qoida
 * majburlanadigan bo'lsa — u XATO qaytarishi kerak.
 */
export type BranchIdsError =
  | { code: "empty" }
  | { code: "unknown"; ids: number[] }
  | { code: "out-of-scope"; ids: number[] }
  | { code: "remove-out-of-scope"; ids: number[] };

export interface BranchIdsResult {
  ok: boolean;
  ids: number[];
  error?: BranchIdsError;
}

export async function validateBranchIds(
  db: Db,
  raw: unknown,
  scope: Pick<BranchScope, "allowed" | "isAdmin">,
  /**
   * Xodimning HOZIRGI a'zoligi (tahrirda). Faqat O'ZGARISH tekshiriladi:
   * qo'shilayotgan va olib tashlanayotgan filiallar `scope.allowed` da
   * bo'lishi kerak, bor a'zolik esa tegilmaydi. Yangi xodimda — bo'sh.
   *
   * NEGA (09.10.2026, 1+2 hovuzi): ro'yxat hovuz bo'yicha, `scope.allowed`
   * esa qat'iy — 1-filial HR xodimi 2-filialdagi xodimning ismini tuzatsa
   * ham forma uning `branchIds: [2]` ini qayta yuborardi va 400 olardi.
   * Olib tashlash ham tekshiriladi: aks holda 2-filial xodimi hamkasbni
   * 1-filialdan (va uning oyligidan) chiqarib yuborardi.
   */
  current: readonly number[] = [],
): Promise<BranchIdsResult> {
  const rows = await db.collection("branches").find({}, { projection: { id: 1, _id: 0 } }).toArray();
  const valid = new Set(rows.map((r) => Number(r.id)).filter(Number.isFinite));

  const ids = [...new Set((Array.isArray(raw) ? raw : []).map(Number).filter(Number.isFinite))]
    .sort((a, b) => a - b);

  if (ids.length === 0) return { ok: false, ids, error: { code: "empty" } };

  const unknown = ids.filter((id) => !valid.has(id));
  if (unknown.length > 0) return { ok: false, ids, error: { code: "unknown", ids: unknown } };

  // IMTIYOZ OSHIRISH TESHIGINI YOPADI.
  //
  // Bugun bu tekshiruv UMUMAN yo'q: `/management-xodimlar` ruxsati bo'lgan
  // xodim o'z yozuvini PATCH qilib `branchIds` ga 3- va 4-filialni
  // qo'shishi va shu bilan o'z qamrovini kengaytirishi mumkin edi
  // (`getBranchScope` keshi atigi 10 soniya).
  //
  // Admin bundan mustasno — u hamma filialni ko'radi.
  if (!scope.isAdmin) {
    const had = new Set(current);
    const added = ids.filter((id) => !had.has(id) && !scope.allowed.includes(id));
    if (added.length > 0) return { ok: false, ids, error: { code: "out-of-scope", ids: added } };
    const removed = current.filter((id) => !ids.includes(id) && !scope.allowed.includes(id));
    if (removed.length > 0) return { ok: false, ids, error: { code: "remove-out-of-scope", ids: removed } };
  }

  return { ok: true, ids };
}

/** Xatoni foydalanuvchi o'qiydigan matnga. */
export function branchIdsErrorText(e: BranchIdsError, nameOf: (id: number) => string): string {
  switch (e.code) {
    case "empty":
      return "Kamida bitta filialni tanlang";
    case "unknown":
      return `Filial topilmadi: ${e.ids.join(", ")}`;
    case "out-of-scope":
      return `Sizda ${e.ids.map(nameOf).join(", ")} filialiga xodim biriktirish huquqi yo'q`;
    case "remove-out-of-scope":
      return `Sizda xodimni ${e.ids.map(nameOf).join(", ")} filialidan chiqarish huquqi yo'q`;
  }
}

/**
 * Xodimning OYLIK UYI — oylikka va hisobga ta'sir qiladigan o'zgarishlar
 * (foiz, karta, soliq, sanalar, arxiv, telefon, ruxsatlar, o'chirish) shu
 * filialga biriktirilgan xodimga yoki adminga ruxsat etiladi (09.10.2026).
 *
 * NEGA: 1+2 hovuzida Xodimlar ro'yxati umumiy, oylik esa filial bo'yicha
 * (lib/branchPools.ts). Bu qoidasiz 2-filial HR xodimi 1-filial oyligidagi
 * o'qituvchining foizini o'zgartirishi, uni arxivlashi yoki o'chirishi
 * mumkin edi — o'zi esa 1-filial Oylik sahifasini ochib natijani ko'ra
 * olmasdi. `scope.allowed` QAT'IY (hovuz bilan kengaytirilmaydi).
 */
export function canManageEmployeePayroll(
  // `object`: Mongo hujjati ham, `HrEmployee` ham o'tsin (faqat-ixtiyoriy
  // maydonli tip — weak type — `WithId<Document>` ni rad etardi).
  row: object,
  scope: Pick<BranchScope, "allowed" | "isAdmin">,
): boolean {
  if (scope.isAdmin) return true;
  const emp = row as { payrollBranchId?: unknown; branchIds?: unknown };
  const ids = Array.isArray(emp.branchIds) ? emp.branchIds.map(Number).filter(Number.isFinite) : [];
  const home = Number(emp.payrollBranchId);
  const payrollHome = Number.isFinite(home) && emp.payrollBranchId !== null && emp.payrollBranchId !== undefined ? home : ids[0];
  return payrollHome !== undefined && scope.allowed.includes(payrollHome);
}

/**
 * Oylik uyini tanlaydi. Berilgan qiymat a'zolik ichida bo'lmasa —
 * birinchi filial.
 *
 * INVARIANT: `payrollBranchId ∈ branchIds`. U buziladigan yagona yo'l —
 * `branchIds` qisqartirilganda oylik uyi tashqarida qolib ketishi, shu
 * bois chaqiruvchi HAR SAFAR shu funksiyadan o'tkazadi.
 */
export function resolvePayrollBranch(ids: number[], wanted: unknown): number {
  const n = Number(wanted);
  return Number.isFinite(n) && ids.includes(n) ? n : ids[0];
}

/**
 * `hr_employees` uchun filial sharti.
 *
 * ⚠ `branchCondition()` (lib/branchScope.ts) NI ISHLATIB BO'LMAYDI va u
 * JIMGINA YOLG'ON beradi. U skalyar `branchId` ni qidiradi va 1-filial
 * uchun "maydoni yo'q hujjatlar ham kirsin" yumshatishini qo'shadi.
 * `hr_employees` da esa `branchId` maydoni UMUMAN YO'Q — natijada
 * 1-filialda 54/54 xodim, 2/3/4-filialda 0/54. Xato chiqmaydi, oddiy
 * bo'sh ekran bo'lib prodga o'tib ketadi.
 *
 * Mongo'da massivga tenglik "element ichida bormi" degani — `$elemMatch`
 * kerak emas.
 *
 * `$exists: false` YUMSHATISHI ATAYLAB YO'Q: o'lchandi, 54/54 hujjatda
 * `branchIds` bor. Ya'ni yumshatish bugun o'lik kod, ertaga esa
 * filialsiz yaratilgan xodimni jimgina 1-filialga tushirib, xatoni
 * YASHIRARDI. Filialsiz xodim — bu bug va u ko'rinishi kerak.
 */
export function employeeBranchCondition(scope: BranchScope): Filter<Document> {
  // HOVUZ (09.10.2026, lib/branchPools.ts): 1- yoki 2-filialda turib
  // ikkalasining xodimi ko'rinadi — ro'yxat, o'qituvchi/moderator tanlovi.
  const pool = branchPool(scope.branchId);
  return pool.length === 1 ? { branchIds: pool[0] } : { branchIds: { $in: [...pool] } };
}

export function withEmployeeBranch<T extends Document>(filter: Filter<T>, scope: BranchScope): Filter<T> {
  return { $and: [filter, employeeBranchCondition(scope)] } as Filter<T>;
}

/**
 * FAQAT joriy filial xodimlari, hovuzsiz — oylikka bog'liq hisobotlar uchun
 * (Xodimlar balansi, app/api/reports/balance): oylik filial bo'yicha qoladi
 * (lib/branchPools.ts), ya'ni pul raqamlari ham o'sha qamrovda.
 */
export function strictScopedEmployeeFilter<T extends Document>(filter: Filter<T>, scope: BranchScope): Filter<T> {
  return { $and: [filter, { branchIds: scope.branchId }] } as Filter<T>;
}

/**
 * Xodim ro'yxati uchun filial sharti — ADMIN UCHUN HAM.
 *
 * NIMA NOTO'G'RI EDI: bu yerda `scope.isAdmin ? filter : …` istisnosi
 * turardi va u ikkita zarar keltirdi.
 *
 * 1) LOYIHANING O'Z QARORIGA ZID. lib/branchScope.ts da ochiq yozilgan:
 *    «"Barcha filiallar" rejimi YO'Q — hamma, admin ham, aniq bitta
 *    filialda turadi». Admin filialni ALMASHTIRA oladi (`scope.allowed`
 *    unda hamma filial), lekin bir vaqtda bittasida turadi.
 *
 * 2) EKRANNI BUZDI. Xodimlar ro'yxati admin uchun kesilmasdi (54 qator),
 *    oylik ro'yxati esa `payrollBranchId` bo'yicha kesilardi (2-filialda
 *    1 qator). Ro'yxatdagi "Ish turi" ustuni oylik qatorini xodim id'si
 *    bo'yicha qidiradi va topolmagach HAMMASINI "Sozlanmagan" deb
 *    ko'rsatardi — go'yo 53 xodimning oyligi yo'qolgandek.
 *
 * QOIDA: xodim ro'yxati va oylik ro'yxati BIR XIL qamrovda turishi shart.
 * Ular har xil maydon bo'yicha kesiladi (`branchIds` va
 * `payrollBranchId`) — bu ataylab — lekin ikkalasi ham JORIY filialga
 * nisbatan, istisnosiz.
 *
 * 09.10.2026 dan ro'yxat HOVUZ bo'yicha (1+2), Oylik sahifasi esa filial
 * bo'yicha qoldi. Shuning uchun Xodimlar ro'yxati va profil oylik
 * qatorlarini `employees-payroll?branch=pool` dan oladi (hovuzning ikkala
 * filiali) — aks holda boshqa filial oyligidagi xodim «Sozlanmagan»
 * bo'lib ko'rinardi. Oylik chiqarish sahifasi esa parametrsiz — qat'iy.
 */
export function scopedEmployeeFilter<T extends Document>(filter: Filter<T>, scope: BranchScope): Filter<T> {
  return withEmployeeBranch(filter, scope);
}

/**
 * Ish haqi biriktiruvlari a'zolik ichida bo'lishi kerak.
 *
 * Tashlanganlar ALOHIDA qaytariladi: `salary > 0` bo'lgani tashlansa
 * chaqiruvchi 400 beradi. Jimgina tashlash — bugungi 13 500 000 so'mlik
 * nomuvofiqlikni sezdirmay o'chirish degani bo'lardi.
 */
export function pruneAssignments(
  assignments: EmployeeBranchAssignment[],
  ids: number[],
): { kept: EmployeeBranchAssignment[]; dropped: EmployeeBranchAssignment[] } {
  const set = new Set(ids);
  const kept: EmployeeBranchAssignment[] = [];
  const dropped: EmployeeBranchAssignment[] = [];
  for (const a of assignments) (set.has(a.branchId) ? kept : dropped).push(a);
  return { kept, dropped };
}

/** Filial id → nomi (xato matnlari uchun). */
export async function branchNameMap(db: Db): Promise<Map<number, string>> {
  const rows = await db.collection("branches").find({}, { projection: { id: 1, name: 1, _id: 0 } }).toArray();
  return new Map(rows.map((r) => [Number(r.id), String(r.name ?? `Filial ${r.id}`)]));
}
