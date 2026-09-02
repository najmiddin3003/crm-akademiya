import { cookies } from "next/headers";
import type { Db, Filter, Document } from "mongodb";
import { ensureIndexes } from "@/lib/mongodb";
import { getCurrentEmployee } from "@/lib/currentEmployee";

// FILIAL QAMROVI — navbardagi tanlov saytdagi ma'lumotni haqiqatan
// o'zgartirishi uchun yagona manba.
//
// QAROR (foydalanuvchi bilan kelishilgan):
//   • O'quv qismi va moliya filial bo'yicha AJRATILADI (o'quvchilar,
//     guruhlar, xonalar, davomat, imtihonlar, kassalar, tranzaksiyalar,
//     oylik, lidlar).
//   • Sozlamalar UMUMIY qoladi (to'lov turlari, tranzaksiya turlari,
//     rollar, soliqlar, kurslar, SMS shablonlari) — ular tizim sozlamasi.
//   • Bitta xodim BIR NECHTA filialda ishlashi mumkin.
//   • Admin uchun "Barcha filiallar" rejimi bor.
//
// NIMA UCHUN COOKIE: tanlov SERVERGA yetib borishi shart, chunki kesish
// serverda bo'ladi (klientda kesish — ma'lumot baribir tarmoqdan
// o'tgani, ya'ni ko'rinmasa ham yuborilgani degani). `localStorage`
// serverga ko'rinmaydi, URL parametri esa har bir havolaga ilashib
// yurishi kerak bo'lardi.

/** Tanlangan filial cookie'si. `httpOnly` EMAS — klient ham o'qiydi. */
export const BRANCH_COOKIE = "branch";

/** "Barcha filiallar" rejimi — faqat admin uchun. */
export const ALL_BRANCHES = "all";

export interface BranchScope {
  /**
   * Joriy tanlov: filial `id` si yoki `null` — "barcha filiallar".
   * `null` FAQAT adminda bo'ladi.
   */
  branchId: number | null;
  /** Foydalanuvchi ko'ra oladigan filiallar (admin — hammasi). */
  allowed: number[];
  isAdmin: boolean;
}

/** Bazadagi barcha filial id'lari (kichik ro'yxat — 4 ta). */
async function allBranchIds(db: Db): Promise<number[]> {
  const rows = await db.collection("branches").find({}, { projection: { id: 1, _id: 0 } }).sort({ id: 1 }).toArray();
  return rows.map((r) => Number(r.id)).filter(Number.isFinite);
}

/**
 * Xodim ishlaydigan filiallar.
 *
 * `hr_employees.branchIds` — ATAYLAB YANGI maydon. Mavjud
 * `branchAssignments` ni ishlatib bo'lmaydi: u FILIAL BO'YICHA ISH HAQI
 * ro'yxati va o'lchandi — 11 ta to'ldirilgan xodimning 9 tasida
 * `branchId: 3` ("Akademiya 3 Uychi") turibdi, holbuki bazadagi butun
 * ma'lumot 1-filialga tegishli. Ya'ni u yerdagi filial oylik sozlagichida
 * tanlangan qiymat, ish joyi emas.
 *
 * Maydon yo'q xodimda bo'sh ro'yxat qaytadi va chaqiruvchi uni 1-filialga
 * tushiradi (migratsiya shu qoidaga tayanadi).
 */
async function employeeBranchIds(db: Db, employeeId: number | null): Promise<number[]> {
  if (employeeId === null) return [];
  const emp = await db.collection("hr_employees").findOne({ id: employeeId }, { projection: { branchIds: 1, _id: 0 } });
  const raw = Array.isArray(emp?.branchIds) ? emp.branchIds : [];
  return raw.map((x) => Number(x)).filter(Number.isFinite);
}

/**
 * Joriy so'rov uchun filial qamrovi.
 *
 * `null` — tizimga kirilmagan.
 *
 * Tanlov cookie'dan olinadi, lekin U ISHONCHLI EMAS: foydalanuvchi uni
 * qo'lda o'zgartirib boshqa filialga o'tib olishi mumkin. Shu bois qiymat
 * har safar RUXSAT ETILGAN ro'yxatga solishtiriladi va mos kelmasa
 * birinchi ruxsat etilganga tushadi.
 */
export async function getBranchScope(): Promise<BranchScope | null> {
  const me = await getCurrentEmployee();
  if (!me) return null;

  const db = await ensureIndexes();
  const all = await allBranchIds(db);
  if (me.isAdmin) {
    const raw = (await cookies()).get(BRANCH_COOKIE)?.value ?? "";
    // Admin sukut bo'yicha HAMMASINI ko'radi.
    if (raw === "" || raw === ALL_BRANCHES) return { branchId: null, allowed: all, isAdmin: true };
    const n = Number(raw);
    return { branchId: all.includes(n) ? n : null, allowed: all, isAdmin: true };
  }

  const mine = await employeeBranchIds(db, me.employeeId);
  // Biriktirilmagan xodim — 1-filial. Bo'sh ro'yxat qaytarish uni butun
  // saytdan uzib qo'yardi; migratsiyagacha hamma 1-filialda.
  const allowed = mine.filter((id) => all.includes(id));
  const fallback = allowed[0] ?? all[0] ?? 1;
  const raw = (await cookies()).get(BRANCH_COOKIE)?.value ?? "";
  const n = Number(raw);
  return {
    // Xodimda "barcha filiallar" YO'Q — u doim bitta filialda turadi.
    branchId: allowed.includes(n) ? n : fallback,
    allowed: allowed.length > 0 ? allowed : [fallback],
    isAdmin: false,
  };
}

/**
 * Mongo filtriga filial shartini qo'shadi.
 *
 * "Barcha filiallar" rejimida filtr TEGILMAYDI. Aks holda `branchId`
 * bo'yicha kesiladi va MAYDONI YO'Q hujjatlar ham 1-filialga tegishli deb
 * qaraladi — migratsiya oralig'ida (yoki u yiqilib qolsa) ma'lumot
 * ko'rinmay qolmasligi uchun.
 */
export function withBranch<T extends Document>(filter: Filter<T>, scope: BranchScope): Filter<T> {
  if (scope.branchId === null) return filter;
  const cond =
    scope.branchId === 1
      ? { $or: [{ branchId: 1 }, { branchId: { $exists: false } }, { branchId: null }] }
      : { branchId: scope.branchId };
  return { $and: [filter, cond] } as Filter<T>;
}

/**
 * Yangi hujjatga yoziladigan filial.
 *
 * `null` — "Barcha filiallar" rejimi, ya'ni QAYSI filial ekani noma'lum.
 * Chaqiruvchi bunda 400 qaytarishi va foydalanuvchidan filialni tanlashni
 * so'rashi kerak. Jimgina birinchi filialga muhrlash XAVFLI: admin sukut
 * bo'yicha aynan shu rejimda turadi, ya'ni uning yaratgan har bir yozuvi
 * bilinmasdan 1-filialga tushib ketardi.
 */
export function branchForInsert(scope: BranchScope): number | null {
  return scope.branchId;
}
