import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { staffFromInitData } from "@/lib/staffBot/webapp";

// GET /api/xodim/me — «👤 Profilim» Mini App'ining birinchi so'rovi: bu
// Telegram akkaunti qaysi xodim ekani (lib/staffBot/webapp.ts). Profil
// ma'lumotining o'zi /api/xodim/data orqali keladi.

const NO_STORE = { "Cache-Control": "private, no-store" };

export async function GET(req: Request) {
  try {
    const db = await ensureIndexes();
    const auth = await staffFromInitData(db, req.headers.get("x-telegram-init-data") || "");
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status, headers: NO_STORE });
    }
    return NextResponse.json({ ok: true, employee: { id: auth.employee.id, name: auth.employee.name } }, { headers: NO_STORE });
  } catch (e) {
    console.error("[xodim/me]", e);
    return NextResponse.json(
      { ok: false, error: "Server xatosi — birozdan keyin qayta urinib ko'ring" },
      { status: 500, headers: NO_STORE },
    );
  }
}
