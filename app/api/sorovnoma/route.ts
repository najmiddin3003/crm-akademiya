import { createHash } from "node:crypto";
import { NextResponse, after } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { createSurveyLead } from "@/lib/ordersCreate";
import { phone9, validateSurvey, type SurveySubmission } from "@/lib/survey";
import { loadSurveyConfig } from "@/lib/surveyServer";

// POST /api/sorovnoma — ommaviy so'rovnoma javobi (/sorovnoma) → yangi lid.
//
// SESSIYASIZ OCHIQ (scripts/gen-api-permissions.mjs → PUBLIC_METHODS), shu
// bois SPAMDAN HIMOYA shu yerda, to'rt qavat:
//   1) yashirin maydon (`website`) — odam ko'rmaydi, bot to'ldiradi;
//   2) to'ldirish vaqti (`ms`) — uch qadamni 3 soniyadan tez to'ldirib
//      bo'lmaydi. Mijoz soati EMAS, o'tgan vaqt yuboriladi: telefon soati
//      noto'g'ri bo'lsa ham haqiqiy odam to'silmaydi;
//   3) IP bo'yicha chegara — 10 daqiqada 5 ta, kuniga 20 ta;
//   4) bir raqamdan 10 daqiqa ichida qayta yuborilsa — ikkinchi lid
//      yaratilmaydi (odam "yuborildimi?" deb ikki marta bosadi).
// 1–2 da bot "muvaffaqiyat" javobini oladi, lekin hech narsa yozilmaydi —
// nima ushlaganini bilmasin. Hisoblagich `survey_hits` da, bir kunlik TTL
// bilan (lib/mongodb.ts); IP va raqam xeshlanib saqlanadi.
//
// Javob (lid) — lib/ordersCreate.ts → createSurveyLead: Lidlar sahifasiga
// "Sayt so'rovnomasi" manbasi bilan va filial Telegram topigiga tushadi.

export const runtime = "nodejs";

const MIN_FILL_MS = 3_000;
const WINDOW_MS = 10 * 60_000;
const PER_WINDOW = 5;
const PER_DAY = 20;
const MAX_BODY = 8_000;

const hash = (s: string) => createHash("sha256").update(`sorovnoma:${s}`).digest("hex").slice(0, 32);

/** Mijoz IP'si — nginx ortida (deploy/README.md) birinchi `X-Forwarded-For`. */
function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for") || "";
  return fwd.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}

const ok = () => NextResponse.json({ ok: true });
const fail = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: Request) {
  const raw = await req.text().catch(() => "");
  if (!raw || raw.length > MAX_BODY) return fail("Noto'g'ri so'rov");
  let body: Partial<SurveySubmission>;
  try {
    body = JSON.parse(raw);
  } catch {
    return fail("Noto'g'ri so'rov");
  }
  if (!body || typeof body !== "object") return fail("Noto'g'ri so'rov");

  // 1–2) Bot belgisi — jim "muvaffaqiyat".
  if (typeof body.website === "string" && body.website.trim()) return ok();
  if (!(Number(body.ms) >= MIN_FILL_MS)) return ok();

  const db = await ensureIndexes();
  const cfg = await loadSurveyConfig(db);
  const v = validateSurvey(cfg, body);
  if (!v.ok) return fail(v.error);

  // 3) IP chegarasi — urinish avval yoziladi: parallel so'rovlar ham sanalsin.
  const hits = db.collection("survey_hits");
  const now = Date.now();
  const ipHash = hash(clientIp(req));
  const telHash = hash(phone9(v.value.phone));
  const [inWindow, inDay, sameTel] = await Promise.all([
    hits.countDocuments({ ipHash, at: { $gte: new Date(now - WINDOW_MS) } }),
    hits.countDocuments({ ipHash, at: { $gte: new Date(now - 86_400_000) } }),
    hits.findOne({ telHash, orderId: { $exists: true }, at: { $gte: new Date(now - WINDOW_MS) } }, { projection: { _id: 1 } }),
  ]);
  if (inWindow >= PER_WINDOW || inDay >= PER_DAY) {
    return fail("Juda ko'p urinish — birozdan keyin qayta yuboring yoki filialga qo'ng'iroq qiling.", 429);
  }
  const hit = await hits.insertOne({ ipHash, telHash, at: new Date(now) });

  // 4) Shu raqam hozirgina yuborgan — ikkinchi lid kerak emas.
  if (sameTel) return ok();

  try {
    const order = await createSurveyLead(db, v.value, { defer: after });
    await hits.updateOne({ _id: hit.insertedId }, { $set: { orderId: order.id } });
  } catch (e) {
    console.error("[sorovnoma]", e instanceof Error ? e.message : e);
    return fail("Saqlab bo'lmadi — birozdan keyin qayta urinib ko'ring.", 500);
  }
  return ok();
}
