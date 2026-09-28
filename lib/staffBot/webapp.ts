import type { Db } from "mongodb";
import { loadStaffBotConfig } from "@/lib/staffBot/config";
import { resolveAccess } from "@/lib/staffBot/auth";
import { getStaffUser } from "@/lib/staffBot/session";
import { verifyInitData } from "@/lib/studentBot/webapp";
import type { HrEmployee } from "@/lib/hrEmployees";

// XODIMLAR BOTI — «👤 Profilim» Mini App kirishi (28.09.2026).
//
// `initData` XODIMLAR bot kaliti (TELEGRAM_BOT_TOKEN) bilan tekshiriladi —
// o'quvchilar botiniki bilan emas: tugma shu botda, Telegram imzoni shu
// kalit bilan qo'yadi. Imzo tekshiruvi umumiy (lib/studentBot/webapp.ts,
// HMAC-SHA256, 24 soatdan eski emas).
//
// XODIM ID'SI KLIENTDAN OLINMAYDI: Telegram foydalanuvchisi → botdagi
// sessiya (`staff_bot_users.chatId` — shaxsiy yozishmada foydalanuvchi
// id'siga teng) → `resolveAccess`, ya'ni bot tugmalari bilan AYNAN bir xil
// tekshiruv: xodim arxivlansa, raqami o'zgarsa, hisobi bloklansa Mini App
// ham shu zahoti yopiladi.

export type StaffTgAuth =
  | { ok: true; employee: HrEmployee }
  | { ok: false; status: 401 | 403 | 404 | 503; error: string };

/**
 * Bir Mini App ochilishi ~16 ta parallel so'rov yuboradi (profil sahifasi
 * tablarining manbalari). Har biri uchun sessiya va ruxsatni qayta o'qish
 * 60+ kichik so'rov bo'lardi — natija qisqa muddat `initData` bo'yicha
 * keshlanadi (lib/branchScope.ts dagi naqsh: qiymat emas, promise).
 * Muddat qisqa: bot'dan chiqilsa yoki xodim arxivlansa kechikish shu qadar.
 */
const AUTH_TTL_MS = 15_000;
const authCache = new Map<string, { at: number; req: Promise<StaffTgAuth> }>();

async function resolveStaff(db: Db, initData: string): Promise<StaffTgAuth> {
  const cfg = loadStaffBotConfig();
  if (!cfg.token) return { ok: false, status: 503, error: "Bot sozlanmagan" };
  const v = verifyInitData(initData, cfg.token);
  if (!v.ok) return { ok: false, status: 401, error: v.error };

  const user = await getStaffUser(db, v.tgUserId);
  if (!user || user.stage !== "in") {
    return { ok: false, status: 403, error: "Avval botga kiring: /start bosing va raqamingizni yuboring." };
  }
  const res = await resolveAccess(db, user);
  if (!res.ok) return { ok: false, status: 403, error: res.error };

  const empId = res.access.identity.employeeId;
  if (empId === null) {
    return { ok: false, status: 404, error: "Hisobingiz xodimlar ro'yxatidagi profilga bog'lanmagan. Administratorga murojaat qiling." };
  }
  const row = await db.collection<HrEmployee>("hr_employees").findOne({ id: empId }, { projection: { _id: 0 } });
  if (!row) return { ok: false, status: 404, error: "Xodim topilmadi" };
  return { ok: true, employee: row as HrEmployee };
}

export function staffFromInitData(db: Db, initData: string): Promise<StaffTgAuth> {
  const now = Date.now();
  const hit = authCache.get(initData);
  if (hit && now - hit.at < AUTH_TTL_MS) return hit.req;
  const req = resolveStaff(db, initData).catch((e) => {
    // Xato keshlanmasin — bazaning bir lahzalik uzilishi hamma so'rovni yiqitmasin.
    authCache.delete(initData);
    throw e;
  });
  authCache.set(initData, { at: now, req });
  if (authCache.size > 300) {
    for (const [k, v] of authCache) if (now - v.at >= AUTH_TTL_MS) authCache.delete(k);
  }
  return req;
}
