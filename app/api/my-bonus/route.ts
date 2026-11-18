import { NextResponse } from "next/server";
import { myBonus } from "@/lib/bonusKpi";
import { getBranchScope } from "@/lib/branchScope";
import { currentAuthorName, getCurrentEmployee } from "@/lib/currentEmployee";
import { ensureIndexes } from "@/lib/mongodb";

// «Bonusim» (39-qism, lib/bonusKpi.ts → myBonus) — tizimga kirgan xodimning faqat O'Z sotuv bonusi.
// Direktor `?name=` bilan istalgan adminning oynasini ko'ra oladi (Sozlamalar → Bonus va KPI panelidan).
export async function GET(req: Request) {
  const [scope, me] = await Promise.all([getBranchScope(), getCurrentEmployee()]);
  if (!scope || !me) return NextResponse.json({ ok: false, error: "Sessiya topilmadi" }, { status: 401 });
  const asName = (new URL(req.url).searchParams.get("name") ?? "").trim().slice(0, 80);
  const name = me.isAdmin ? asName || (await currentAuthorName()) : me.name;
  if (!name) return NextResponse.json({ ok: false, error: "Xodim kartasi topilmadi" }, { status: 404 });
  const db = await ensureIndexes();
  return NextResponse.json(await myBonus(db, scope, name));
}
