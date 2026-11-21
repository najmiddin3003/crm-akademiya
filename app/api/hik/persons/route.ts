import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";
import { linkPerson, unlinkPerson } from "@/lib/hikAdmin";

// /api/hik/persons — terminaldagi «Employee No.» ni xodim yoki o'quvchiga bog'lash (lib/hikAdmin.ts).
//   POST   { employeeNo, personType: "employee"|"student", personId } — bog'laydi va shu
//          raqamning jurnalda kutib turgan voqealarini davomatga yozadi (`replayed`);
//   DELETE ?employeeNo= — uzadi (yozilgan davomat qoladi).
// FAQAT ADMIN.

const NO_STORE = { "Cache-Control": "private, no-store" };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });

async function admin() {
  const me = await getCurrentUser();
  if (!me) return json({ ok: false, error: "Tizimga kirmagansiz" }, 401);
  if (me.role !== "admin") return json({ ok: false, error: "Terminallarni faqat administrator sozlaydi" }, 403);
  return null;
}

export async function POST(req: Request) {
  const denied = await admin();
  if (denied) return denied;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "Noto'g'ri so'rov" }, 400);
  }
  const db = await ensureIndexes();
  const res = await linkPerson(db, body ?? {});
  return res.ok ? json(res) : json(res, res.status);
}

export async function DELETE(req: Request) {
  const denied = await admin();
  if (denied) return denied;
  const employeeNo = new URL(req.url).searchParams.get("employeeNo")?.trim() ?? "";
  if (!employeeNo) return json({ ok: false, error: "Noto'g'ri so'rov" }, 400);
  const db = await ensureIndexes();
  const res = await unlinkPerson(db, employeeNo);
  return res.ok ? json(res) : json(res, res.status);
}
