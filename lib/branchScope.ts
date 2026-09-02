import { cookies } from "next/headers";
import type { Db, Filter, Document } from "mongodb";
import { ensureIndexes } from "@/lib/mongodb";
import { getCurrentEmployee } from "@/lib/currentEmployee";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

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
//   • "Barcha filiallar" rejimi YO'Q — hamma, admin ham, aniq bitta
//     filialda turadi. Sukut — birinchi filial.
//
// NIMA UCHUN COOKIE: tanlov SERVERGA yetib borishi shart, chunki kesish
// serverda bo'ladi (klientda kesish — ma'lumot baribir tarmoqdan
// o'tgani, ya'ni ko'rinmasa ham yuborilgani degani). `localStorage`
// serverga ko'rinmaydi, URL parametri esa har bir havolaga ilashib
// yurishi kerak bo'lardi.

/** Tanlangan filial cookie'si. `httpOnly` EMAS — klient ham o'qiydi. */
export const BRANCH_COOKIE = "branch";

export interface BranchScope {
  /**
   * Joriy filial. DOIM aniq bitta filial — "barcha filiallar" rejimi YO'Q.
   *
   * Ilgari admin uchun `null` ("hammasi") bor edi va u SUKUT holat edi.
   * Ikki muammosi chiqdi: kesilmagan qamrov sukut bo'yicha yoqiq turardi,
   * va o'sha rejimda yaratilgan har bir yozuv qaysi filialga tegishli
   * ekani noma'lum bo'lib qolardi. Endi hamma — admin ham — aniq bitta
   * filialda turadi.
   */
  branchId: number;
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
 * Kesh MUDDATI — lib/rolePermissions.ts dagi bilan bir xil qolip.
 *
 * NIMA UCHUN KERAK: qamrov kesilgan HAR BIR route shu funksiyani
 * chaqiradi, u esa uchtagacha Atlas so'rovi qiladi (users →
 * hr_employees → branches) va ustiga `getCurrentUser()` ning o'z
 * so'rovlari. O'lchandi: Atlas gacha bitta borib kelish 165 ms, va
 * qamrov kesilgan endpoint kesilmaganidan ~350 ms sekinroq edi —
 * `/api/rooms` 19 ta hujjat (2 KB) uchun 582 ms olardi.
 *
 * Bahosi: xodimga filial biriktirilishi yoki filial qo'shilishi
 * shuncha kechikish bilan yetadi. Filial ALMASHTIRILGANDA kechikish
 * YO'Q — kalit ichida cookie qiymati bor, ya'ni boshqa tanlov boshqa
 * yozuvga tushadi.
 */
const SCOPE_TTL_MS = 10_000;
const scopeCache = new Map<string, { at: number; value: BranchScope }>();

/**
 * Joriy so'rov uchun filial qamrovi. `null` — tizimga kirilmagan.
 *
 * Tanlov cookie'dan olinadi, lekin U ISHONCHLI EMAS: foydalanuvchi uni
 * qo'lda o'zgartirib boshqa filialga o'tib olishi mumkin. Shu bois qiymat
 * har safar RUXSAT ETILGAN ro'yxatga solishtiriladi (`loadBranchScope`)
 * va mos kelmasa birinchi ruxsat etilganga tushadi.
 */
export async function getBranchScope(): Promise<BranchScope | null> {
  const jar = await cookies();
  const raw = jar.get(BRANCH_COOKIE)?.value ?? "";

  // Kalit SESSIYA IMZOSIDAN olinadi — bu bosqichda bazaga borilmaydi
  // (`verifySessionToken` sof kriptografiya). Kesh shu bois butun
  // zanjirni — `getCurrentEmployee()` ning uchta so'rovini ham —
  // chetlab o'tadi. Ilgari kesh o'sha zanjirdan KEYIN turgani uchun
  // deyarli hech narsa tejamasdi.
  const session = await verifySessionToken(jar.get(SESSION_COOKIE)?.value);
  if (!session) return null;

  const key = `${session.uid}:${session.sid ?? ""}:${raw}`;
  const now = Date.now();
  const hit = scopeCache.get(key);
  if (hit && now - hit.at < SCOPE_TTL_MS) return hit.value;

  // Hisob FAOL ekani bu yerda tekshirilmaydi — uni proxy allaqachon
  // qiladi (proxy.ts → accessForSession, o'zi ham 10 s keshli) va
  // bloklangan foydalanuvchi /api/* ga umuman yetib kelmaydi. Bu
  // funksiya faqat "qaysi filial" savoliga javob beradi.
  const me = await getCurrentEmployee();
  if (!me) return null;

  const value = await loadBranchScope(me, raw);
  scopeCache.set(key, { at: now, value });
  if (scopeCache.size > 500) {
    for (const [k, v] of scopeCache) if (now - v.at >= SCOPE_TTL_MS) scopeCache.delete(k);
  }
  return value;
}

async function loadBranchScope(
  me: { isAdmin: boolean; employeeId: number | null },
  raw: string,
): Promise<BranchScope> {
  const db = await ensureIndexes();
  const all = await allBranchIds(db);
  const n = Number(raw);

  if (me.isAdmin) {
    // Sukut — birinchi filial ("Akademiya 1 Chortoq").
    return { branchId: all.includes(n) ? n : (all[0] ?? 1), allowed: all, isAdmin: true };
  }

  const mine = await employeeBranchIds(db, me.employeeId);
  // Biriktirilmagan xodim — birinchi filial. Bo'sh ro'yxat qaytarish uni
  // butun saytdan uzib qo'yardi.
  const allowed = mine.filter((id) => all.includes(id));
  const fallback = allowed[0] ?? all[0] ?? 1;
  return {
    branchId: allowed.includes(n) ? n : fallback,
    allowed: allowed.length > 0 ? allowed : [fallback],
    isAdmin: false,
  };
}

/**
 * Mongo filtriga filial shartini qo'shadi.
 *
 * BIRINCHI filialda maydoni YO'Q hujjatlar ham qo'shiladi: migratsiya
 * oralig'ida (yoki u yiqilib qolsa) ma'lumot ko'rinmay qolmasligi uchun.
 */
export function withBranch<T extends Document>(filter: Filter<T>, scope: BranchScope): Filter<T> {
  const cond =
    scope.branchId === 1
      ? { $or: [{ branchId: 1 }, { branchId: { $exists: false } }, { branchId: null }] }
      : { branchId: scope.branchId };
  return { $and: [filter, cond] } as Filter<T>;
}

/**
 * Yangi hujjatga yoziladigan filial.
 *
 * Doim aniq bitta filial — "barcha filiallar" rejimi olib tashlangan.
 */
export function branchForInsert(scope: BranchScope): number {
  return scope.branchId;
}
