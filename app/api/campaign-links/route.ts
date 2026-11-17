import { NextResponse } from "next/server";
import { campaignReport, saveCampaign, type CampaignInput } from "@/lib/campaignLinks";
import { currentAuthorName } from "@/lib/currentEmployee";
import { ensureIndexes } from "@/lib/mongodb";
import { reportCtx } from "@/lib/reportRoute";

// Sotuv va marketing → Kampaniya havolalari (36-qism, lib/campaignLinks.ts).
//   GET ?from&to&branch&kind — havolalar va natijalari; POST — havola yaratish / tahrirlash / to'xtatish.
export async function GET(req: Request) {
  const c = await reportCtx(req);
  if (c instanceof NextResponse) return c;
  const db = await ensureIndexes();
  return NextResponse.json(await campaignReport(db, c.br.ids, c.from, c.to, String(c.sp.get("kind") ?? "")));
}

export async function POST(req: Request) {
  const c = await reportCtx(req);
  if (c instanceof NextResponse) return c;
  const b = (await req.json().catch(() => null)) as CampaignInput | null;
  if (!b || typeof b !== "object") return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  const db = await ensureIndexes();
  const r = await saveCampaign(db, b, await currentAuthorName(), c.scope.isAdmin ? null : c.scope.allowed);
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
