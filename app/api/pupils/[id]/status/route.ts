import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { getBranchScope, withBranch } from "@/lib/branchScope";
import { isPupilStatus, type Pupil } from "@/lib/pupilsData";

// PATCH /api/pupils/:id/status — { status, reason? }
//
// O'quvchini Aktiv / Muzlatilgan / Arxiv holatiga o'tkazadi. Holat oddiy
// profil formasi orqali o'zgartirilmaydi (PATCH /api/pupils/:id dagi
// EDITABLE ro'yxatida yo'q), chunki bu alohida amal: sabab yoziladi va
// sana qayd etiladi.
//
// Arxivga o'tkazilgan o'quvchi guruhlardan ham chiqariladi — aks holda u
// davomat jadvalida va guruh ro'yxatida qolib ketardi.
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

  const status = body.status;
  if (!isPupilStatus(status)) {
    return NextResponse.json({ ok: false, error: "Holat noto'g'ri" }, { status: 400 });
  }
  const reason = String(body.reason ?? "").trim();
  if (status !== "Aktiv" && !reason) {
    return NextResponse.json({ ok: false, error: "Sababni kiriting" }, { status: 400 });
  }

  const now = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const today = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;

  // Boshqa filialning o'quvchisi bu yerdan o'zgartirilmaydi — qamrov
  // PATCH /api/pupils/:id dagi bilan bir xil (u yerdagi izohga qarang).
  const scope = await getBranchScope();
  if (!scope) return NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });

  const db = await ensureIndexes();
  const res = await db.collection("pupils").findOneAndUpdate(
    withBranch({ id: pupilId }, scope),
    { $set: { status, statusChangedAt: today, statusReason: status === "Aktiv" ? "" : reason } },
    { returnDocument: "after" },
  );
  if (!res) {
    return NextResponse.json({ ok: false, error: "O'quvchi topilmadi" }, { status: 404 });
  }

  if (status === "Arxiv") {
    await db
      .collection<{ studentIds?: number[] }>("groups")
      .updateMany({ studentIds: pupilId }, { $pull: { studentIds: pupilId } });
  }

  const { _id, studentPasswordHash, parentPasswordHash, ...pupil } = res;
  void _id; void studentPasswordHash; void parentPasswordHash;
  return NextResponse.json({ ok: true, pupil: pupil as unknown as Pupil });
}
