import { NextResponse, after } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getBranchScope } from "@/lib/branchScope";
import { currentAuthorName } from "@/lib/currentEmployee";
import { isHolat, type LeadGuruh, type LeadSinov } from "@/lib/leadHolat";
import { applyHolatChange, undoHolatChange } from "@/lib/leadHolatServer";
import { refreshLeadMessage } from "@/lib/leadNotify";
import { withLeadScope } from "@/lib/leadScope";
import { ensureIndexes } from "@/lib/mongodb";
import type { Order } from "@/lib/ordersData";

// POST /api/orders/:id/holat — Lidlar sahifasidagi holat tugmalari.
//
//   { action: "set", to, sinov?, guruh?, radSabab? } — holatni o'zgartirish
//   { action: "undo" }                                — oxirgisini bekor qilish
//
// Mantiq lib/leadHolatServer.ts da (Telegram tugmasi ham o'shani
// chaqiradi). Qamrov PATCH /api/orders/:id bilan AYNAN bir xil
// (`withLeadScope`): ro'yxatda ko'ringan lidning holati o'zgartiriladi.
// Guruhga yozishning o'zi (o'quvchi yaratish, guruhga qo'shish) mijozda
// lib/enrollStudent.ts orqali OLDINROQ bajariladi — bu yerga natija keladi.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

function parseSinov(v: unknown): LeadSinov | null | "bad" {
  if (v === undefined || v === null) return null;
  if (typeof v !== "object") return "bad";
  const o = v as Record<string, unknown>;
  const sana = str(o.sana, 10);
  const vaqt = str(o.vaqt, 5);
  if (!DATE_RE.test(sana) || !TIME_RE.test(vaqt)) return "bad";
  return { sana, vaqt, oqituvchi: str(o.oqituvchi, 120) };
}

function parseGuruh(v: unknown): LeadGuruh | null | "bad" {
  if (v === undefined || v === null) return null;
  if (typeof v !== "object") return "bad";
  const o = v as Record<string, unknown>;
  const id = Number(o.id);
  const nom = str(o.nom, 120);
  const boshlash = str(o.boshlash, 10);
  if (!Number.isInteger(id) || id < 0 || !nom || (boshlash && !DATE_RE.test(boshlash))) return "bad";
  return { id, nom, kun: str(o.kun, 120), vaqt: str(o.vaqt, 40), boshlash };
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isFinite(orderId)) return bad("Noto'g'ri id");

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return bad("Noto'g'ri so'rov");
  }
  if (!body || typeof body !== "object") return bad("Noto'g'ri so'rov");

  const [me, scope] = await Promise.all([getCurrentUser(), getBranchScope()]);
  if (!me || !scope) return bad("Tizimga kirmagansiz", 401);
  const author = await currentAuthorName();
  const by = author || String(me.fullName ?? "").trim() || "CRM";

  const db = await ensureIndexes();
  const filter = withLeadScope({ id: orderId }, scope, author);
  const order = (await db.collection("orders").findOne(filter, { projection: { _id: 0 } })) as unknown as Order | null;
  if (!order) return bad("Lid topilmadi", 404);

  let out;
  if (body.action === "undo") {
    out = await undoHolatChange(db, filter, order, by, me.role === "admin");
  } else if (body.action === "set") {
    if (!isHolat(body.to)) return bad("Noma'lum holat");
    const sinov = parseSinov(body.sinov);
    const guruh = parseGuruh(body.guruh);
    if (sinov === "bad") return bad("Sinov darsining sanasi yoki vaqti noto'g'ri");
    if (guruh === "bad") return bad("Guruh ma'lumoti noto'g'ri");
    out = await applyHolatChange(db, filter, order, {
      to: body.to,
      sinov: sinov ?? undefined,
      guruh: guruh ?? undefined,
      radSabab: str(body.radSabab, 200) || undefined,
      by,
      via: "crm",
      assignModerator: author || undefined,
    });
  } else {
    return bad("Noma'lum amal");
  }

  if (!out.ok) return bad(out.error, out.status);
  // Guruhdagi xabarning "Status:" qatori ham shu holatni ko'rsatsin.
  after(() => refreshLeadMessage(db, orderId));
  return NextResponse.json({ ok: true, order: out.order });
}
