import { ObjectId, type Db } from "mongodb";
import { compareSecret, isValidPhone, normalizePhone } from "@/lib/invite";
import { approvalBlocks, approvalError } from "@/lib/adminApproval";
import { employeeNameById, nameEq } from "@/lib/currentEmployee";
import { resolvePermissions } from "@/lib/rolePermissions";
import { isPathAllowed } from "@/lib/permissions";
import type { CashboxMethodTotals } from "@/lib/cashboxes";
import type { LoginIdentity, StaffBotUser } from "@/lib/staffBot/session";

// XODIMLAR BOTIGA KIRISH VA RUXSAT — web bilan BIR XIL qoidalar.
//
// KIRISH (`verifyStaffLogin`) app/api/auth/login/route.ts ning aynan
// nusxasi: o'sha telefon, o'sha `passwordHash`, o'sha holat tekshiruvlari
// (`frozen`/`blocked`/`active`) va o'sha ikki bosqichli tasdiq
// (lib/adminApproval.ts). Farq faqat natijada — cookie emas, bazadagi
// bog'lanish (lib/staffBot/session.ts). Kassir web'da kira olsa botda
// ham kira oladi, kira olmasa — botda ham yo'q.
//
// RUXSAT (`resolveAccess`) HAR AMALDA qayta o'qiladi, bir marta kirishda
// emas: CRM'da xodim bloklansa, ruxsati olinsa yoki kassa boshqa odamga
// berilsa bot keyingi bosishdayoq shunga ergashadi. Narxi — 3-4 ta kichik
// so'rov, bu to'lov yozishning yonida sezilmaydi.
//
// KASSA — web'dagi GET /api/cashboxes qoidasi: xodim faqat O'ZIGA
// biriktirilgan kassani (`cashboxes.moderator` = uning ismi) ko'radi;
// admin hammasini — botda sukut bo'yicha BOSH kassa (foydalanuvchi qarori,
// 18.09.2026), xohlasa boshqasini tanlaydi (`staff_bot_users.cashboxId`).

export type LoginResult =
  | { ok: true; identity: LoginIdentity }
  | { ok: false; error: string };

export async function verifyStaffLogin(db: Db, rawPhone: string, password: string): Promise<LoginResult> {
  if (!isValidPhone(rawPhone) || !password) {
    return { ok: false, error: "Telefon raqam va parolni to'liq kiriting" };
  }
  const phone = normalizePhone(rawPhone);
  const user = await db.collection("users").findOne(
    { phone },
    { projection: { passwordHash: 1, status: 1, role: 1, hrEmployeeId: 1, adminApproval: 1 } },
  );
  // Login route'idagi bilan bir xil matn: hisob bormi-yo'qmi oshkor qilinmaydi.
  if (!user || !user.passwordHash) return { ok: false, error: "Telefon raqam yoki parol noto'g'ri" };
  if (user.status === "frozen") {
    return { ok: false, error: "Hisobingiz vaqtincha muzlatilgan. Administratorga murojaat qiling." };
  }
  if (user.status === "blocked") {
    return { ok: false, error: "Hisobingiz bloklangan. Administratorga murojaat qiling." };
  }
  if (user.status !== "active") return { ok: false, error: "Telefon raqam yoki parol noto'g'ri" };

  const match = await compareSecret(password, String(user.passwordHash));
  if (!match) return { ok: false, error: "Telefon raqam yoki parol noto'g'ri" };

  // Ikki bosqichli tasdiq — parol to'g'ri bo'lsa ham admin ✓ bosmaguncha
  // kirmaydi (lib/adminApproval.ts).
  if (approvalBlocks(user.adminApproval)) return { ok: false, error: approvalError(user.adminApproval) };

  const employeeId = Number(user.hrEmployeeId);
  const empId = Number.isFinite(employeeId) ? employeeId : null;
  return {
    ok: true,
    identity: {
      userId: user._id.toString(),
      employeeId: empId,
      name: await employeeNameById(db, empId),
      isAdmin: user.role === "admin",
      phone,
    },
  };
}

/** Bot ishlaydigan kassa — faqat kerakli maydonlar. */
export interface BotCashbox {
  id: number;
  name: string;
  moderator: string;
  balance: number;
  methodTotals: CashboxMethodTotals;
  branchId?: number;
  isPrimary: boolean;
}

export interface StaffAccess {
  identity: LoginIdentity;
  /**
   * Raqam ulashib kirgan — faqat «Profilim» (28.09.2026). Kassa/lid
   * tugmalari ko'rsatilmaydi, ruxsatlar `false`.
   */
  profileOnly: boolean;
  /** Profil rejimida: shu raqamda sayt hisobi (parol) bor — «Parol bilan kirish» taklif qilinadi. */
  webLogin: boolean;
  /** Kassa amallari ruxsati — `/finance-cash` (web'dagi bilan bir xil kalit). */
  canCash: boolean;
  /** Lid qo'shish ruxsati — `/orders-list` (POST /api/orders shu kalit bilan yopiq). */
  canLead: boolean;
  /** `null` — xodimga kassa biriktirilmagan (yoki admin tanlagan kassa yo'qolgan). */
  cashbox: BotCashbox | null;
}

export type AccessResult =
  | { ok: true; access: StaffAccess }
  /** `logout: true` — hisob endi yaroqsiz, bog'lanish o'chirilsin. */
  | { ok: false; error: string; logout: boolean };

const CASHBOX_FIELDS = { _id: 0, id: 1, name: 1, moderator: 1, balance: 1, methodTotals: 1, branchId: 1, isPrimary: 1 } as const;

function asBotCashbox(row: Record<string, unknown> | null): BotCashbox | null {
  if (!row) return null;
  return {
    id: Number(row.id),
    name: String(row.name ?? ""),
    moderator: String(row.moderator ?? ""),
    balance: Number(row.balance ?? 0),
    methodTotals: (row.methodTotals as CashboxMethodTotals | undefined) ?? {},
    branchId: typeof row.branchId === "number" ? row.branchId : undefined,
    isPrimary: row.isPrimary === true,
  };
}

/** Kirgan foydalanuvchining kassasi — qoidalar yuqoridagi izohda. */
export async function findBotCashbox(db: Db, user: Pick<StaffBotUser, "isAdmin" | "name" | "cashboxId">): Promise<BotCashbox | null> {
  const col = db.collection("cashboxes");
  if (user.isAdmin) {
    if (typeof user.cashboxId === "number") {
      const chosen = await col.findOne({ id: user.cashboxId, archived: { $ne: true } }, { projection: CASHBOX_FIELDS });
      if (chosen) return asBotCashbox(chosen as Record<string, unknown>);
      // Tanlangan kassa arxivlangan/o'chirilgan — bosh kassaga tushiladi.
    }
    return asBotCashbox(await col.findOne({ isPrimary: true, archived: { $ne: true } }, { projection: CASHBOX_FIELDS }) as Record<string, unknown> | null);
  }
  if (!user.name) return null;
  // Arxivlangan kassa pul qabul qilmaydi — web ro'yxatida ko'rinsa ham
  // botda ishlatilmaydi.
  return asBotCashbox(
    await col.findOne({ moderator: nameEq(user.name), archived: { $ne: true } }, { projection: CASHBOX_FIELDS }) as Record<string, unknown> | null,
  );
}

/** Admin tanlashi mumkin bo'lgan kassalar — arxivlanmaganlari, bosh kassa birinchi. */
export async function listCashboxesForAdmin(db: Db): Promise<BotCashbox[]> {
  const rows = await db.collection("cashboxes")
    .find({ archived: { $ne: true } }, { projection: CASHBOX_FIELDS })
    .sort({ isPrimary: -1, id: 1 })
    .toArray();
  return rows.map((r) => asBotCashbox(r as Record<string, unknown>)!).filter(Boolean);
}

/** Raqamdan faqat raqamlar, oxirgi 9 tasi — CRM'da raqam turli shaklda yozilgan. */
const last9 = (v: unknown) => String(v ?? "").replace(/\D/g, "").slice(-9);

/**
 * Faol (arxivlanmagan) xodim telefon bo'yicha — raqam ULASHIB kirish uchun
 * (28.09.2026). Bir raqam ikki faol xodimda bo'lsa — hech kim (taxmin
 * qilinmaydi, administrator tuzatadi).
 */
export async function findEmployeeByPhone(db: Db, rawPhone: string): Promise<{ id: number; name: string } | null> {
  const want = last9(rawPhone);
  if (want.length !== 9) return null;
  const rows = await db
    .collection("hr_employees")
    .find({ archReason: { $in: ["", null] } }, { projection: { _id: 0, id: 1, name: 1, phone: 1 } })
    .toArray();
  const hits = rows.filter((r) => last9(r.phone) === want);
  if (hits.length !== 1) return null;
  return { id: Number(hits[0].id), name: String(hits[0].name ?? "").trim() };
}

/** Shu raqamda parolli sayt hisobi bormi — profil rejimidagi «Parol bilan kirish» tugmasi uchun. */
export async function hasWebLogin(db: Db, rawPhone: string): Promise<boolean> {
  if (!isValidPhone(rawPhone)) return false;
  const u = await db.collection("users").findOne(
    { phone: normalizePhone(rawPhone), passwordHash: { $exists: true, $nin: ["", null] } },
    { projection: { _id: 1 } },
  );
  return !!u;
}

/**
 * Raqam ulashib kirgan xodim — faqat profil. Xodim arxivlansa yoki
 * o'chirilsa bog'lanish yaroqsiz (keyingi bosishda chiqariladi).
 */
async function resolveProfileAccess(db: Db, user: StaffBotUser): Promise<AccessResult> {
  const empId = Number(user.employeeId);
  if (!Number.isFinite(empId)) return { ok: false, error: "Tizimga kirmagansiz", logout: true };
  const emp = await db.collection("hr_employees").findOne(
    { id: empId },
    { projection: { _id: 0, name: 1, phone: 1, archReason: 1 } },
  );
  if (!emp) return { ok: false, error: "Xodim topilmadi — qayta kiring.", logout: true };
  if (!["", null, undefined].includes(emp.archReason)) {
    return { ok: false, error: "Siz xodimlar ro'yxatida faol emassiz. Administratorga murojaat qiling.", logout: true };
  }
  // Raqam CRM'da almashtirilgan bo'lsa — eski raqam bilan ulangan sessiya yopiladi.
  if (last9(emp.phone) !== last9(user.phone)) {
    return { ok: false, error: "Telefon raqamingiz CRM'da o'zgargan — qayta kiring.", logout: true };
  }
  const phone = String(user.phone ?? "");
  return {
    ok: true,
    access: {
      identity: { userId: "", employeeId: empId, name: String(emp.name ?? "").trim(), isAdmin: false, phone },
      profileOnly: true,
      webLogin: await hasWebLogin(db, phone),
      canCash: false,
      canLead: false,
      cashbox: null,
    },
  };
}

export async function resolveAccess(db: Db, user: StaffBotUser): Promise<AccessResult> {
  if (user.stage === "in" && user.viaContact) return resolveProfileAccess(db, user);
  if (user.stage !== "in" || !user.userId || !ObjectId.isValid(user.userId)) {
    return { ok: false, error: "Tizimga kirmagansiz", logout: true };
  }
  const account = await db.collection("users").findOne(
    { _id: new ObjectId(user.userId) },
    { projection: { status: 1, role: 1, hrEmployeeId: 1, phone: 1, adminApproval: 1 } },
  );
  if (!account) return { ok: false, error: "Hisob topilmadi — qayta kiring.", logout: true };
  if (account.status !== "active") {
    return { ok: false, error: "Hisobingiz faol emas. Administratorga murojaat qiling.", logout: true };
  }
  if (approvalBlocks(account.adminApproval)) {
    return { ok: false, error: approvalError(account.adminApproval), logout: true };
  }

  const isAdmin = account.role === "admin";
  const empRaw = Number(account.hrEmployeeId);
  const employeeId = Number.isFinite(empRaw) ? empRaw : null;
  // Ism har safar QAYTA o'qiladi — xodim qayta nomlansa kassa bog'lanishi
  // (`moderator` ism bo'yicha) o'sha zahoti yangi ismga qaraydi.
  const name = await employeeNameById(db, employeeId);

  const perms = await resolvePermissions(db, {
    _id: account._id,
    phone: account.phone,
    hrEmployeeId: account.hrEmployeeId,
    role: account.role,
  });

  const identity: LoginIdentity = { userId: user.userId, employeeId, name, isAdmin, phone: String(account.phone ?? "") };
  return {
    ok: true,
    access: {
      identity,
      profileOnly: false,
      webLogin: true,
      canCash: isPathAllowed("/finance-cash", perms),
      canLead: isPathAllowed("/orders-list", perms),
      cashbox: await findBotCashbox(db, { isAdmin, name, cashboxId: user.cashboxId }),
    },
  };
}
