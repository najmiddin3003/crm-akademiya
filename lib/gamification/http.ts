import { NextResponse } from "next/server";
import type { Db } from "mongodb";
import { getGamActor, type GamActor } from "./actor";
import { GamBusyError, gamDb } from "./db";
import { GamError } from "./wallet";

// Gamifikatsiya route'lari uchun umumiy yordamchilar. Xato matni
// o'zbekcha (kalit) ketadi — mijoz uni o'zi tarjima qiladi (lib/i18n.ts).
// Kodlar TZ 9: 401 — kirilmagan, 403 — huquq yo'q, 409 — holat
// to'qnashuvi, 422 — tekshiruv (limit, balans, maydon).

export function fail(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status });
}

type Ctx = { db: Db; actor: GamActor };

/**
 * Joriy xodimning gamifikatsiyadagi roli. `director` berilsa — faqat
 * direktorga ruxsat (Sozlamalar → Gamifikatsiya, TZ 3).
 */
export async function withActor(opts: { director?: boolean } = {}): Promise<Ctx | NextResponse> {
  const db = await gamDb();
  const actor = await getGamActor(db);
  if (!actor) return fail(403, "Gamifikatsiyada sizga rol biriktirilmagan");
  if (opts.director && actor.role !== "director") return fail(403, "Bu amal faqat direktor uchun");
  return { db, actor };
}

/** Kutilgan xatolar — o'z kodi bilan; kutilmagani — 500 (tafsiloti logda). */
export function handleError(e: unknown) {
  if (e instanceof GamError) return fail(e.status, e.message);
  if (e instanceof GamBusyError) return fail(409, e.message);
  console.error("[gamification]", e);
  return fail(500, "Server xatosi — birozdan keyin qayta urinib ko'ring");
}

export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json();
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
