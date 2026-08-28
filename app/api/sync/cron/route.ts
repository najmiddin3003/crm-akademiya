import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { loadSyncConfig } from "@/lib/sync/config";
import { runSyncCycle } from "@/lib/sync/run";
import { digestLines, digestMessages, digestPeriodFor, runSalaryDigest } from "@/lib/sync/salaryDigest";

// GET /api/sync/cron — kunlik tekshiruv (sutkasiga bir marta).
//
// Uch ish bajaradi:
//   1) Oyning 15-kuni va oxirgi kunida (Toshkent vaqti) "O'qituvchilar
//      oyliklari" topikiga umumiy oylik xulosasini yuboradi. Boshqa
//      kunlarda bu qadam hech narsa qilmaydi.
//   2) Navbatda osilib qolganlarni qayta yuboradi (internet uzilgan,
//      Google limiti, bot bloklangan holatlar).
//   3) Google Sheets'ni baza bilan SOLISHTIRADI — yetishmagan qatorlarni
//      qo'shadi, eskirganini yangilaydi, dublikatni o'chiradi.
//
// Natija `sync_runs` ga yoziladi va Moliya > Sinxronizatsiya sahifasida
// ko'rinadi. TEKSHIRUV NATIJASI Telegram'ga yuborilmaydi — guruhga
// faqat 1-banddagi oylik xulosasi va o'quvchi to'lovlari boradi.
//
// `?preview=digest` — xulosani yubormasdan ko'rish (quyida).
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
/** Oyliklar xulosasiga ajratilgan vaqt (oyda ikki kun ishlatiladi). */
const DIGEST_MS = 8_000;

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
  // `?preview=digest` — oyliklar xulosasini YUBORMASDAN ko'rish.
  // Xulosa oyda atigi ikki marta ketadi, ya'ni matnda xato bo'lsa
  // keyingi imkoniyat ikki hafta keyin. Shu sabab uni oldindan
  // ko'radigan yo'l kerak, va u terminaldan ham ishlashi kerak —
  // Sinxronizatsiya sahifasi tizimga kirishni talab qiladi.
  // Hech narsa yuborilmaydi va bazaga yozilmaydi.
  const params = new URL(req.url).searchParams;
  if (params.get("preview") === "digest") {
    // `&at=<ISO>` — "o'sha kuni nima ketardi" degan savolga javob.
    // Kun tekshiruvi UTC va Toshkent orasidagi 5 soatga bog'liq
    // (cron 22:00 UTC = ertasi 03:00 Toshkent), shuning uchun uni
    // haqiqiy 15-kunni kutmasdan sinab ko'rish imkoni kerak.
    const raw = params.get("at");
    const now = raw ? new Date(raw) : new Date();
    if (Number.isNaN(now.getTime())) {
      return NextResponse.json({ ok: false, error: "at: sana noto'g'ri" }, { status: 400 });
    }
    const db = await ensureIndexes();
    const period = digestPeriodFor(now);
    const at = new Date(now.getTime() + 5 * 3_600_000);
    const data = await digestLines(db, period?.at ?? at);
    return NextResponse.json({
      ok: true, preview: true,
      wouldSend: period !== null,
      period: period?.key ?? "(bu kunda xulosa yuborilmaydi)",
      teachers: data.teachers.length, others: data.others.length,
      messages: digestMessages(period ?? { key: "-", label: "hozirgi holat", at }, data),
    });
  }

  try {
    // Oyliklar xulosasi SOLISHTIRISHDAN OLDIN. Sabab: runSyncCycle qolgan
    // butun vaqtni reconcile'ga beradi (lib/sync/run.ts), keyin qo'yilsa
    // xulosaga vaqt qolmasdi. O'zi esa bir necha soniya oladi va faqat
    // oyning 15-kuni hamda oxirgi kunida ish bajaradi.
    //
    // AYNAN SHU YERDA, runSyncCycle ichida EMAS: o'sha funksiyani
    // Sinxronizatsiya sahifasidagi "To'liq tekshirish" tugmasi ham
    // chaqiradi, ya'ni har bosishda guruhga xulosa ketib qolardi.
    const db = await ensureIndexes();
    const digest = await runSalaryDigest(db);
    const result = await runSyncCycle("cron", (maxDuration * 1000) - RESERVE_MS - DIGEST_MS);
    return NextResponse.json({ ok: true, digest, ...result });
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
