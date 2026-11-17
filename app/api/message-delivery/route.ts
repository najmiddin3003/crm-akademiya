import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { getBranchScope } from "@/lib/branchScope";
import { messageDelivery } from "@/lib/messageDelivery";
import { uzDateIso } from "@/lib/uzTime";

// Nazorat → Xabarlar yetkazilishi (34-qism). GET ?from&to — faqat o'qish (lib/messageDelivery.ts).
// /api/sms-messages ishlatilmaydi: uning POST i haqiqiy SMS yuboradi (ruxsat sahifaga bog'lanadi).

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request) {
  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const today = uzDateIso();
  const from = ISO.test(sp.get("from") ?? "") ? sp.get("from")! : `${today.slice(0, 7)}-01`;
  const to = ISO.test(sp.get("to") ?? "") ? sp.get("to")! : today;
  const db = await ensureIndexes();
  return NextResponse.json(await messageDelivery(db, from, to));
}
