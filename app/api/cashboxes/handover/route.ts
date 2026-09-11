import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { getCurrentEmployee } from "@/lib/currentEmployee";
import { loadHandoverReport } from "@/lib/handoverReport";
import { uzDateIso } from "@/lib/uzTime";

// GET /api/cashboxes/handover?date=YYYY-MM-DD — kunlik topshiruv hisoboti:
// har bir filial kassasi shu kuni qancha yig'di, sarfladi va rahbar
// kassaga qanchasini jo'natdi (lib/handoverReport.ts).
//
// KIM KO'RADI: admin yoki bosh kassaning egasi. Filial kassiri ko'rmaydi —
// bu rahbarning nazorat oynasi, unda boshqa kassalarning raqamlari bor.
export async function GET(req: Request) {
  const me = await getCurrentEmployee();
  if (!me) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });

  const db = await ensureIndexes();
  const col = db.collection("cashboxes");
  const primary = await col.findOne({ isPrimary: true }, { projection: { _id: 0, id: 1, moderator: 1 } });
  if (!primary) return NextResponse.json({ ok: false, error: "Bosh kassa belgilanmagan" }, { status: 404 });
  // Egasi ism bo'yicha (`cashboxes.moderator` = `hr_employees.name`), katta-kichik
  // harf va chekka bo'shliqlar farq qilmaydi — GET /api/cashboxes dagi
  // `nameEq` bilan bir xil qoida.
  const norm = (s: string) => s.trim().toLowerCase();
  if (!me.isAdmin && !(me.name && norm(me.name) === norm(String(primary.moderator || "")))) {
    return NextResponse.json({ ok: false, error: "Bu hisobot faqat rahbar kassa uchun" }, { status: 403 });
  }

  const raw = new URL(req.url).searchParams.get("date") || "";
  // uzDateIso() argumentsiz — uzNow() bilan ikki marta siljib, UTC serverda
  // kechqurun ertangi kunga o'tib ketardi (lib/cashboxStats.ts izohi).
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : uzDateIso();

  // Arxivdagi kassa hisobotga kirmaydi — u pul yig'maydi.
  const branches = await col
    .find({ isPrimary: { $ne: true }, archived: { $ne: true } })
    .project<{ id: number; name: string; moderator?: string; balance?: number }>({ _id: 0, id: 1, name: 1, moderator: 1, balance: 1 })
    .sort({ id: 1 })
    .toArray();

  const report = await loadHandoverReport(
    db,
    date,
    primary.id as number,
    branches.map((b) => ({ id: b.id, name: b.name, moderator: b.moderator || "", balance: Number(b.balance) || 0 })),
  );
  return NextResponse.json({ ok: true, ...report });
}
