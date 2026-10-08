import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { getBranchScope } from "@/lib/branchScope";
import { setPupilStatus } from "@/lib/pupilWrite";

// PATCH /api/pupils/:id/status — { status, reason? }
//
// O'quvchini Aktiv / Muzlatilgan / Arxiv holatiga o'tkazadi. Holat oddiy
// profil formasi orqali o'zgartirilmaydi (PATCH /api/pupils/:id dagi
// EDITABLE ro'yxatida yo'q), chunki bu alohida amal: sabab yoziladi va
// sana qayd etiladi.
//
// Arxivga o'tkazilgan o'quvchi guruhlardan ham chiqariladi — aks holda u
// davomat jadvalida va guruh ro'yxatida qolib ketardi.
//
// Mantiq lib/pupilWrite.ts da (AI yordamchi ham shuni chaqiradi).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pupilId = Number(id);
  if (!Number.isFinite(pupilId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }

  let body: { status?: unknown; reason?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  // Boshqa filialning o'quvchisi bu yerdan o'zgartirilmaydi — qamrov
  // PATCH /api/pupils/:id dagi bilan bir xil (u yerdagi izohga qarang).
  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });

  const db = await ensureIndexes();
  const out = await setPupilStatus(db, scope, pupilId, body.status, body.reason);
  if (!out.ok) return NextResponse.json({ ok: false, error: out.error }, { status: out.status });
  return NextResponse.json({ ok: true, pupil: out.pupil });
}
