import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, after } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { ingestHikEvents, MAX_EVENTS_PER_CALL } from "@/lib/hikTerminal";

// POST /api/hik/events — YUZ TERMINALI voqealari (lib/hikTerminal.ts, 21.11.2026).
//
// Chaqiruvchi — serverdagi ISUP ko'prigi (terminal internet orqali unga
// ulanadi), brauzer emas. Sessiya yo'q; himoya — `x-hik-secret` sarlavhasi
// (env HIK_BRIDGE_SECRET, kamida 16 belgi). Kalit URL'ga QO'YILMAYDI.
//
// Body: { deviceId: "<terminal ISUP Device ID>", events: [<ISAPI voqea JSON>, …] }
//   • events bo'sh bo'lsa — faqat «terminal tirik» belgisi (lastSeenAt).
//   • Bir chaqiruvda ko'pi bilan MAX_EVENTS_PER_CALL ta; takror yuborilgan
//     voqea ikkinchi marta yozilmaydi (`duplicate`) — ko'prik javob kelmasa
//     bemalol qayta yuboraveradi.
// Javob: { ok, received, statuses: { applied, repeat, unknown_person, … }, terminal }.

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });

/** Vaqt bo'yicha xavfsiz solishtirish; xesh — uzunlik farqi ham sezilmasin. */
function secretMatches(provided: string, expected: string): boolean {
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

const DEVICE_ID = /^[A-Za-z0-9_.:-]{1,64}$/;

export async function POST(req: Request) {
  const expected = process.env.HIK_BRIDGE_SECRET?.trim() ?? "";
  if (expected.length < 16) return json({ ok: false, error: "Terminal ko'prigi sozlanmagan" }, 503);
  if (!secretMatches(req.headers.get("x-hik-secret") ?? "", expected)) {
    return json({ ok: false, error: "Ruxsat yo'q" }, 401);
  }

  let body: { deviceId?: unknown; events?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "Noto'g'ri so'rov" }, 400);
  }
  const deviceId = typeof body.deviceId === "string" ? body.deviceId.trim() : "";
  if (!DEVICE_ID.test(deviceId)) return json({ ok: false, error: "deviceId noto'g'ri" }, 400);
  const events = body.events === undefined ? [] : body.events;
  if (!Array.isArray(events)) return json({ ok: false, error: "events — massiv bo'lishi kerak" }, 400);
  if (events.length > MAX_EVENTS_PER_CALL) {
    return json({ ok: false, error: `Bir chaqiruvda ko'pi bilan ${MAX_EVENTS_PER_CALL} ta voqea` }, 413);
  }

  try {
    const db = await ensureIndexes();
    const res = await ingestHikEvents(db, deviceId, events, { defer: (fn) => after(fn) });
    return json({ ok: true, ...res });
  } catch (e) {
    console.error("[hik/events]", e);
    return json({ ok: false, error: "Server xatosi" }, 500);
  }
}
