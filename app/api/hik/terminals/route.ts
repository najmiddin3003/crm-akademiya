import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";
import { createTerminal, hikOverview, listenPath, updateTerminal } from "@/lib/hikAdmin";

// /api/hik/terminals — YUZ TERMINALLARI (lib/hikAdmin.ts): Nazorat → Xodimlar
// davomati → «Belgilash usuli» (components/v2/nazorat/FaceTerminalsV2.tsx).
//   GET   — terminallar, bog'lanmagan va bog'langan odamlar, tanlov ro'yxatlari;
//   POST  — terminal qo'shish { name, branchId, deviceId? } → HTTP listening manzili;
//   PATCH — { id, name?, branchId?, active? }.
// FAQAT ADMIN: manzildagi kalit terminal nomidan voqea yozish huquqini beradi,
// sahifa ruxsatining o'zi yetmaydi.

const NO_STORE = { "Cache-Control": "private, no-store" };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });

async function admin() {
  const me = await getCurrentUser();
  if (!me) return json({ ok: false, error: "Tizimga kirmagansiz" }, 401);
  if (me.role !== "admin") return json({ ok: false, error: "Terminallarni faqat administrator sozlaydi" }, 403);
  return null;
}

async function readBody(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const b: unknown = await req.json();
    return b && typeof b === "object" && !Array.isArray(b) ? (b as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const denied = await admin();
  if (denied) return denied;
  const db = await ensureIndexes();
  return json(await hikOverview(db));
}

export async function POST(req: Request) {
  const denied = await admin();
  if (denied) return denied;
  const body = await readBody(req);
  if (!body) return json({ ok: false, error: "Noto'g'ri so'rov" }, 400);
  const db = await ensureIndexes();
  const res = await createTerminal(db, body);
  if (!res.ok) return json(res, res.status);
  const t = res.terminal;
  return json({ ok: true, terminal: { id: t.id, name: t.name, listenPath: t.listenToken ? listenPath(t.listenToken) : null } });
}

export async function PATCH(req: Request) {
  const denied = await admin();
  if (denied) return denied;
  const body = await readBody(req);
  const id = Number(body?.id);
  if (!body || !Number.isInteger(id)) return json({ ok: false, error: "Noto'g'ri so'rov" }, 400);
  const db = await ensureIndexes();
  const res = await updateTerminal(db, id, { name: body.name, branchId: body.branchId, active: body.active });
  if (!res.ok) return json(res, res.status);
  return json({ ok: true, replayed: res.replayed });
}
