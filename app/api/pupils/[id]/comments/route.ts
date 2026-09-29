import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { getBranchScope, withPupilBranch } from "@/lib/branchScope";
import { getCurrentUser } from "@/lib/auth";
import { uzNow } from "@/lib/uzTime";
import { commentView, MAX_COMMENT_LEN, PUPIL_COMMENTS, type PupilComment } from "@/lib/pupilComments";

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

  const now = uzNow();
  const pad = (n: number) => String(n).padStart(2, "0");
  const db = await ensureIndexes();
  const col = db.collection<PupilComment>(PUPIL_COMMENTS);
  // `id` — eng kattasidan keyingisi (loyihadagi naqsh); bir lahzada ikki xodim
  // yozsa ikkinchisi noyob indeksga urilib qayta oladi.
  for (let attempt = 0; attempt < 5; attempt++) {
    const [last] = await col.find({}, { projection: { _id: 0, id: 1 } }).sort({ id: -1 }).limit(1).toArray();
    const comment: PupilComment = {
      id: (Number(last?.id) || 0) + 1,
      pupilId,
      text,
      date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
      time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
      by: String(user.fullName || "").trim(),
      createdAt: new Date(),
    };
    try {
      await col.insertOne({ ...comment });
      return NextResponse.json({ ok: true, comment: commentView(comment) });
    } catch (e) {
      if ((e as { code?: number } | null)?.code !== 11000) throw e;
    }
  }
  return NextResponse.json({ ok: false, error: "Hozir band — qayta urinib ko'ring" }, { status: 503 });
}
