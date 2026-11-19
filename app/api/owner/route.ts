import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getBranchScope } from "@/lib/branchScope";
import { ensureIndexes } from "@/lib/mongodb";
import { advanceDesk, createAdvance, decideAdvance, giveAdvance, salaryState } from "@/lib/advanceRequests";
import { decideException } from "@/lib/priceExceptions";
import { dividendRoom, ownerApprovals, ownerCash, ownerOverview, ownerTransfers } from "@/lib/ownerPanel";
import { uzDateIso } from "@/lib/uzTime";

// RAHBAR PANELI (48-qism, lib/ownerPanel.ts). Ko'rinishlar faqat Rahbar (admin) uchun; avans so'rovini yozish va
// «Berdim» — filial xodimi (o'z filiallari, qabul admin / menejer telefoni).
//   GET  ?view=overview | cash (&from&to&kind&method&page) | transfers (&month) | approvals | dividend (&month)
//        ?view=advance-desk | salary&employeeId   — filial xodimi
//   POST {action: "advance-create" | "advance-give"}                 — filial xodimi
//        {action: "advance-decide" | "price-decide", id, approve, note, amount?} — Rahbar
// Pul amallari (Kirim, Chiqim, Almashtirish, Filialga berish, Dividend, Sarmoya) — mavjud /api/cashboxes/:id/*.
export const dynamic = "force-dynamic";

const json = (b: unknown, status = 200) => NextResponse.json(b, { status });

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return json({ ok: false, error: "Kirish kerak" }, 401);
  const db = await ensureIndexes();
  const sp = new URL(req.url).searchParams;
  const view = sp.get("view") ?? "overview";
  const isAdmin = user.role === "admin";
  if (view === "advance-desk" || view === "salary") {
    const scope = await getBranchScope();
    const allowed = scope?.allowed ?? [];
    if (view === "salary") {
      const id = Number(sp.get("employeeId"));
      const emp = await db.collection("hr_employees").findOne({ id }, { projection: { _id: 0, branchIds: 1 } });
      if (!emp || (!isAdmin && !((emp.branchIds as number[]) ?? []).some((b) => allowed.includes(Number(b))))) return json({ ok: false, error: "Xodim topilmadi" }, 404);
      return json({ ok: true, salary: await salaryState(db, id) });
    }
    return json({ ok: true, ...(await advanceDesk(db, allowed, String(user.fullName || ""))) });
  }
  if (!isAdmin) return json({ ok: false, error: "Rahbar paneli faqat Rahbarga ochiq" }, 403);
  const today = uzDateIso();
  const month = /^\d{4}-\d{2}$/.test(sp.get("month") ?? "") ? String(sp.get("month")) : today.slice(0, 7);
  if (view === "overview") return json({ ok: true, ...(await ownerOverview(db)) });
  if (view === "approvals") return json({ ok: true, ...(await ownerApprovals(db)) });
  if (view === "transfers") {
    const r = await ownerTransfers(db, month);
    return json(r, r.ok ? 200 : 404);
  }
  if (view === "dividend") return json({ ok: true, ...(await dividendRoom(db, month)) });
  if (view === "cash") {
    const iso = (v: string | null, d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v ?? "") ? String(v) : d);
    const r = await ownerCash(db, { from: iso(sp.get("from"), `${today.slice(0, 7)}-01`), to: iso(sp.get("to"), today), kind: sp.get("kind") ?? "all", method: sp.get("method") ?? "", page: Math.max(0, Number(sp.get("page")) || 0) });
    return json(r, r.ok ? 200 : 404);
  }
  return json({ ok: false, error: "Noma'lum ko'rinish" }, 400);
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return json({ ok: false, error: "Kirish kerak" }, 401);
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return json({ ok: false, error: "So'rov o'qilmadi" }, 400);
  const db = await ensureIndexes();
  const isAdmin = user.role === "admin";
  const name = String(user.fullName || user.phone || "");
  if (b.action === "advance-create" || b.action === "advance-give") {
    const scope = await getBranchScope();
    const allowed = scope?.allowed ?? [];
    const r = b.action === "advance-create" ? await createAdvance(db, { name }, allowed, b) : await giveAdvance(db, { name }, allowed, Number(b.id), String(b.method ?? "naqd"));
    return json(r, r.ok ? 200 : r.status);
  }
  if (!isAdmin) return json({ ok: false, error: "Faqat Rahbar tasdiqlaydi" }, 403);
  if (b.action === "advance-decide") {
    const r = await decideAdvance(db, { name }, Number(b.id), b.approve === true, String(b.note ?? ""), b.amount === undefined ? undefined : Number(b.amount));
    return json(r, r.ok ? 200 : r.status);
  }
  if (b.action === "price-decide") {
    const ids = (await db.collection("branches").find({}, { projection: { _id: 0, id: 1 } }).toArray()).map((x) => Number(x.id));
    const r = await decideException(db, ids, { name, isAdmin: true }, Number(b.id), b.approve === true, String(b.note ?? ""));
    return json(r, r.ok ? 200 : r.status);
  }
  return json({ ok: false, error: "Noma'lum amal" }, 400);
}
