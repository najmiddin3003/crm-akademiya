import crypto from "node:crypto";
import type { Db } from "mongodb";
import { loadStudentBotConfig } from "@/lib/studentBot/config";
import { getBotUser, type StudentBotUser } from "@/lib/studentBot/users";

// TELEGRAM WEB APP — o'quvchi botdagi tugma orqali ochadigan sahifaning
// KIRISH QOROVULI.
//
// XAVFSIZLIKNING BUTUN OG'IRLIGI SHU FAYLDA. Web sahifa CRM sessiyasidan
// foydalanmaydi (o'quvchida u yo'q va bo'lmasligi ham kerak), demak
// "bu kim?" degan savolga faqat shu yer javob beradi.
//
// QANDAY ISHLAYDI. Telegram sahifani ochganda unga `initData` — imzolangan
// satr beradi. Imzo bot TOKENIDAN olingan kalit bilan qo'yilgan, ya'ni
// tokenni bilmagan odam uni to'qiy olmaydi:
//
//   secret = HMAC_SHA256(kalit: "WebAppData", ma'lumot: bot_token)
//   hash   = HMAC_SHA256(kalit: secret,      ma'lumot: tekshiruv_satri)
//
// UCHTA QOIDA, uchalasi ham majburiy:
//
// 1. O'QUVCHI ID'SI KLIENTDAN OLINMAYDI. `initData` dan faqat TELEGRAM
//    foydalanuvchi id'si olinadi, o'quvchi esa `student_bot_users` dagi
//    bog'lanishdan topiladi. Aks holda imzo to'g'ri bo'lgan har kim
//    so'rovga begona `pupilId` yozib istalgan bolaning ma'lumotini
//    ochib olardi.
//
// 2. IMZO TEKSHIRILMAGUNCHA HECH NARSA QILINMAYDI — bazaga ham
//    murojaat qilinmaydi.
//
// 3. ESKI `initData` RAD ETILADI. Satr bir marta qo'lga tushsa (masalan
//    jurnalga tushib qolsa) u muddatsiz kalit bo'lib qolardi.

/** `initData` shu muddatdan eski bo'lsa ishlamaydi. */
const MAX_AGE_SEC = 24 * 60 * 60;

export type WebAppAuth =
  | { ok: true; tgUserId: number; user: StudentBotUser }
  | { ok: false; error: string; status: 401 | 403 | 503 };

interface TgWebAppUser {
  id?: number;
}

/**
 * Imzoni tekshiradi va Telegram foydalanuvchi id'sini qaytaradi.
 *
 * Bazaga TEGMAYDI — faqat kriptografiya. Shu bois uni alohida sinash
 * mumkin va qorovulning eng nozik qismi ajratilgan bo'lib qoladi.
 */
export function verifyInitData(initData: string, botToken: string, now = Date.now()): { ok: true; tgUserId: number } | { ok: false; error: string } {
  if (!botToken) return { ok: false, error: "Bot tokeni sozlanmagan" };
  if (!initData) return { ok: false, error: "Kirish ma'lumoti yo'q" };

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return { ok: false, error: "Imzo yo'q" };

  // TEKSHIRUV SATRI: `hash` dan boshqa hamma juftlik, kalit bo'yicha
  // alifbo tartibida, "\n" bilan ulanadi. Tartib MUHIM — Telegram imzoni
  // aynan shu ko'rinishga qo'ygan.
  const pairs: string[] = [];
  for (const [k, v] of params) {
    if (k === "hash") continue;
    pairs.push(`${k}=${v}`);
  }
  pairs.sort();

  const secret = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const mine = crypto.createHmac("sha256", secret).update(pairs.join("\n")).digest("hex");

  // `timingSafeEqual` — oddiy `===` emas: solishtirish vaqti bo'yicha
  // imzoni belgima-belgi topib olish yo'lini yopadi.
  const a = Buffer.from(mine, "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, error: "Imzo to'g'ri kelmadi" };
  }

  const authDate = Number(params.get("auth_date") || 0);
  if (!Number.isFinite(authDate) || authDate <= 0) return { ok: false, error: "Vaqt belgisi yo'q" };
  if (now / 1000 - authDate > MAX_AGE_SEC) {
    return { ok: false, error: "Sahifa eskirdi — botdan qayta oching" };
  }

  let tgUserId = 0;
  try {
    const u = JSON.parse(params.get("user") || "{}") as TgWebAppUser;
    tgUserId = Number(u.id);
  } catch {
    return { ok: false, error: "Foydalanuvchi ma'lumoti o'qilmadi" };
  }
  if (!Number.isFinite(tgUserId) || tgUserId <= 0) return { ok: false, error: "Foydalanuvchi topilmadi" };

  return { ok: true, tgUserId };
}

/**
 * To'liq qorovul: imzo + bazadagi bog'lanish.
 *
 * Bog'lanish YO'Q bo'lsa 403 — sahifa botdagi tugma orqali ochiladi va
 * tugma faqat bog'langan odamda ko'rinadi, ya'ni bu holat odatda
 * "chiqish" qilib qo'yib, eski sahifani ochganda yuz beradi.
 */
export async function authStudentWeb(db: Db, initData: string): Promise<WebAppAuth> {
  const cfg = loadStudentBotConfig();
  if (!cfg.token) return { ok: false, error: "Bot sozlanmagan", status: 503 };

  const v = verifyInitData(initData, cfg.token);
  if (!v.ok) return { ok: false, error: v.error, status: 401 };

  // Shaxsiy yozishmada chat id foydalanuvchi id'siga TENG — bot
  // bog'lanishni aynan shu raqam bo'yicha saqlaydi.
  const user = await getBotUser(db, v.tgUserId);
  if (!user) {
    return { ok: false, error: "Avval botda telefon raqamingizni tasdiqlang", status: 403 };
  }

  return { ok: true, tgUserId: v.tgUserId, user };
}
