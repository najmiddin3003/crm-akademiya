import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { getBranchScope, withPupilBranch } from "@/lib/branchScope";
import { getCurrentUser } from "@/lib/auth";
import { addPupilComment, commentView, MAX_COMMENT_LEN, PUPIL_COMMENTS, type PupilComment } from "@/lib/pupilComments";

// GET  /api/pupils/:id/comments — o'quvchi izohlari (eskisidan yangisiga).
// POST /api/pupils/:id/comments — { text } → izoh qo'shadi.
// Guruh sahifasidagi «Izoh» oynasi (lib/pupilComments.ts). O'quvchi JORIY
// FILIAL QAMROVIDA bo'lishi shart — /api/pupils/:id bilan bir xil: boshqa
// filialniki "topilmadi" (404), mavjudligi ham bildirilmaydi.

const notLoggedIn = () => NextResponse.json({ ok: false, error: "Tizimga kirmagansiz" }, { status: 401 });
const notFound = () => NextResponse.json({ ok: false, error: "O'quvchi topilmadi" }, { status: 404 });

/** O'quvchi qamrovdami: `null` — kirilmagan, `false` — topilmadi. */
async function pupilInScope(pupilId: number): Promise<boolean | null> {
  const scope = await getBranchScope();
  if (!scope) return null;
  const db = await ensureIndexes();
  return Boolean(await db.collection("pupils").findOne(withPupilBranch({ id: pupilId }, scope), { projection: { _id: 1 } }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const pupilId = Number((await params).id);
  if (!Number.isFinite(pupilId)) return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  const ok = await pupilInScope(pupilId);
  if (ok === null) return notLoggedIn();
  if (!ok) return notFound();
  const db = await ensureIndexes();
  const rows = await db
    .collection<PupilComment>(PUPIL_COMMENTS)
    .find({ pupilId }, { projection: { _id: 0 } })
    .sort({ createdAt: 1, id: 1 })
    .limit(500)
    .toArray();
  return NextResponse.json({ ok: true, comments: rows.map(commentView) });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const pupilId = Number((await params).id);
  if (!Number.isFinite(pupilId)) return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  let body: { text?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }
  const text = String(body.text ?? "").trim().slice(0, MAX_COMMENT_LEN);
  if (!text) return NextResponse.json({ ok: false, error: "Izoh matnini kiriting" }, { status: 400 });

  const user = await getCurrentUser();
  if (!user) return notLoggedIn();
  const ok = await pupilInScope(pupilId);
  if (ok === null) return notLoggedIn();
  if (!ok) return notFound();

  // Yozuv lib/pupilComments.ts da — AI yordamchi ham o'sha yadrodan o'tadi.
  const db = await ensureIndexes();
  const out = await addPupilComment(db, { pupilId, text, by: String(user.fullName || "") });
  if (!out.ok) return NextResponse.json({ ok: false, error: out.error }, { status: out.status });
  return NextResponse.json({ ok: true, comment: commentView(out.comment) });
}
