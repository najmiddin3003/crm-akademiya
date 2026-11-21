import { NextResponse, after } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { terminalByToken } from "@/lib/hikAdmin";
import { deviceInfoOf, ingestHikEvents, parseListenBody } from "@/lib/hikTerminal";

// POST /api/hik/listen/<kalit> — YUZ TERMINALI «HTTP listening» (lib/hikTerminal.ts, 21.11.2026).
//
// Terminal (Hikvision) har bir voqeani o'zi shu manzilga yuboradi — SDK va
// ko'prik kerak emas. Manzil terminal web sahifasida yoziladi (Network →
// HTTP Listening); kalit CRM'da terminal qo'shilganda beriladi (lib/hikAdmin.ts)
// va terminalni ham aniqlaydi. Terminal sarlavha qo'sha olmaydi — kalit manzilda.
// Sessiya yo'q (proxy ro'yxatida ochiq); amallar jurnaliga yozilmaydi — o'z
// jurnali bor (hik_events).
//
// Tana — multipart (JSON + rasm) yoki toza JSON; rasm saqlanmaydi.
// Javob doim tez: terminal javob kutib turadi.
//
// GET — kalit to'g'riligini brauzerda tekshirish uchun (faqat terminal nomi).

export const runtime = "nodejs";

/** Rasmli voqea odatda 100–300 KB; undan kattasi — xato yoki hujum. */
const MAX_BODY = 4 * 1024 * 1024;
const NO_STORE = { "Cache-Control": "no-store" };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    if (Number(req.headers.get("content-length") || 0) > MAX_BODY) return json({ ok: false, error: "Juda katta" }, 413);
    const db = await ensureIndexes();
    const terminal = await terminalByToken(db, token);
    if (!terminal) return json({ ok: false, error: "Noma'lum terminal" }, 404);
    const body = new Uint8Array(await req.arrayBuffer());
    if (body.byteLength > MAX_BODY) return json({ ok: false, error: "Juda katta" }, 413);
    const events = parseListenBody(req.headers.get("content-type") ?? "", body);
    const info = events.map(deviceInfoOf).find((x) => x !== null) ?? null;
    const res = await ingestHikEvents(db, terminal.deviceId, events, { defer: (fn) => after(fn), info });
    return json({ ok: true, received: res.received, statuses: res.statuses });
  } catch (e) {
    console.error("[hik/listen]", e);
    return json({ ok: false, error: "Server xatosi" }, 500);
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = await ensureIndexes();
  const terminal = await terminalByToken(db, token);
  if (!terminal) return json({ ok: false, error: "Noma'lum terminal" }, 404);
  return json({ ok: true, terminal: terminal.name });
}
