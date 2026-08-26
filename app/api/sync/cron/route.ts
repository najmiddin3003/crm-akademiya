import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { loadSyncConfig } from "@/lib/sync/config";
import { runSyncCycle } from "@/lib/sync/run";

// GET /api/sync/cron — kunlik tekshiruv (sutkasiga bir marta).
//
// Ikki ish bajaradi:
//   1) Navbatda osilib qolganlarni qayta yuboradi (internet uzilgan,
//      Google limiti, bot bloklangan holatlar).
//   2) Google Sheets'ni baza bilan SOLISHTIRADI — yetishmagan qatorlarni
//      qo'shadi, eskirganini yangilaydi, dublikatni o'chiradi.
//
// Natija `sync_runs` ga yoziladi va Moliya > Sinxronizatsiya sahifasida
// ko'rinadi. Kelishuv bo'yicha Telegram'ga hech narsa yuborilmaydi.
//
// Kim chaqiradi:
//   • Vercel Cron — vercel.json dagi jadval bo'yicha, `Authorization:
//     Bearer $CRON_SECRET` sarlavhasi bilan.
//   • Tashqi xizmat (cron-job.org va h.k.) — `x-cron-secret` sarlavhasi
//     bilan. Maxfiy kalit URL'GA QO'YILMAYDI: manzillar server
//     jurnallarida va brauzer tarixida ochiq qoladi.

export const runtime = "nodejs";
// Vercel'ning bepul (Hobby) rejasida funksiya eng ko'pi 60 soniya
// ishlaydi. Ish shu vaqtga moslab bo'lingan: ulgurilmagan qismi
// hisobotda `remaining` bo'lib qaytadi va ertangi yugurishda davom
// etadi — hech narsa yo'qolmaydi.
export const maxDuration = 60;

/** Hisobotni yozib ulgurish uchun oxirida qoldiriladigan zaxira vaqt. */
const RESERVE_MS = 12_000;

/**
 * Kalitni vaqt bo'yicha xavfsiz solishtirish — oddiy `===` javob
 * qaytarish vaqti orqali kalitni harfma-harf topib olishga imkon beradi.
 */
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function isAuthorized(req: Request): boolean {
  const cfg = loadSyncConfig();
  // Kalit belgilanmagan bo'lsa endpoint ochiq qolmasligi kerak.
  if (!cfg.cronSecret) return false;

  const bearer = req.headers.get("authorization") || "";
  const prefix = "Bearer ";
  if (bearer.startsWith(prefix) && secretMatches(bearer.slice(prefix.length), cfg.cronSecret)) {
    return true;
  }
  const header = req.headers.get("x-cron-secret") || "";
  return Boolean(header) && secretMatches(header, cfg.cronSecret);
}

async function handle(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "Ruxsat yo'q" }, { status: 401 });
  }
  try {
    const result = await runSyncCycle("cron", (maxDuration * 1000) - RESERVE_MS);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "noma'lum xato" },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) {
  return handle(req);
}

/** Ba'zi tashqi cron xizmatlari faqat POST yubora oladi. */
export async function POST(req: Request) {
  return handle(req);
}
