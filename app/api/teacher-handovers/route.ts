import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { getCurrentUser } from "@/lib/auth";
import { isMonthKey } from "@/lib/salary";
import { deleteHandover, dismissHandoverHint, loadHandoverCandidates, saveHandover } from "@/lib/teacherHandoverStore";

// USTOZ ALMASHUVI — Moliya → Oylik hisob-kitob sahifasidagi oyna
// (components/finance/TeacherHandoverModal.tsx). Qoida lib/teacherHandover.ts
// da: oy o'rtasida o'quvchilar boshqa ustozga o'tsa, ESKI ustoz nomidagi shu
// oy to'lovlari kalendar kunlariga qarab bo'linadi. Mantiq
// lib/teacherHandoverStore.ts da, bu yupqa qobiq.
//
// GET    ?month=YYYY-MM&teacher=Ism — oyna ma'lumoti.
// POST   { month, teacher, lastDay, pupils: [{ pupilId, name, toTeacher }] } — saqlash;
//        { action: "dismiss", month, teacher } — "almashuv yo'q", eslatmani yashirish.
// DELETE ?month=YYYY-MM&teacher=Ism — almashuvni olib tashlash.
//
// KASSA VA JURNALGA TEGMAYDI — faqat oylik hisobidagi taqsimot. Ruxsat —
// /finance-payroll sahifasi (lib/apiPermissions.generated.ts).

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

function query(req: Request) {
  const params = new URL(req.url).searchParams;
  return { month: (params.get("month") ?? "").trim(), teacher: (params.get("teacher") ?? "").trim() };
}

export async function GET(req: Request) {
  if (!(await getCurrentUser())) return bad("Tizimga kirmagansiz", 401);
  const { month, teacher } = query(req);
  if (!isMonthKey(month)) return bad("Oy noto'g'ri (YYYY-MM kutiladi)");
  if (!teacher) return bad("Ustoz ko'rsatilmagan");
  const db = await ensureIndexes();
  return NextResponse.json({ ok: true, ...(await loadHandoverCandidates(db, month, teacher)) });
}

export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return bad("Tizimga kirmagansiz", 401);
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return bad("Noto'g'ri so'rov");
  }
  const db = await ensureIndexes();
  // `action: "dismiss"` — "almashuv yo'q": Oylik sahifasidagi eslatmani yashirish.
  const r = body.action === "dismiss"
    ? await dismissHandoverHint(db, body, me.fullName || "")
    : await saveHandover(db, body, me.fullName || "");
  return r.ok ? NextResponse.json(r) : bad(r.error);
}

export async function DELETE(req: Request) {
  if (!(await getCurrentUser())) return bad("Tizimga kirmagansiz", 401);
  const { month, teacher } = query(req);
  if (!isMonthKey(month)) return bad("Oy noto'g'ri (YYYY-MM kutiladi)");
  if (!teacher) return bad("Ustoz ko'rsatilmagan");
  const db = await ensureIndexes();
  return NextResponse.json({ ok: true, deleted: await deleteHandover(db, month, teacher) });
}
