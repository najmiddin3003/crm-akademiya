import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { uzNow } from "@/lib/uzTime";
import { currentAuthorName } from "@/lib/currentEmployee";
import {
  FEEDBACK_STATUSES,
  isFeedbackType,
  type FeedbackRecord,
  type FeedbackStatus,
} from "@/components/nazorat/feedbackTypes";

// Nazorat → Fikr-mulohaza backend'i (MongoDB `feedback`).
//
// NEGA yaratildi: sahifa ilgari `constants/feedback.js` dagi 8 ta o'ylab
// topilgan yozuvni ko'rsatardi va yangi fikr-mulohaza kelib tushadigan
// hech qanday yo'l yo'q edi — ya'ni jadval haqiqatda hech narsani
// aks ettirmasdi. Endi yozuvlar bazadan keladi va sahifadagi "Fikr
// qo'shish" oynasi orqali qo'shiladi.
//
// Qolip app/api/task-types/route.ts dan olingan: demo seed YO'Q, ro'yxat
// bo'sh holatdan boshlanadi.

/** Mahalliy vaqt bo'yicha "YYYY-MM-DDTHH:mm". */
function nowStamp(): string {
  const d = uzNow();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export async function GET() {
  const db = await ensureIndexes();
  const rows = await db.collection("feedback").find({}).sort({ id: -1 }).toArray();
  const feedbacks = rows.map(({ _id, ...rest }) => {
    void _id;
    return rest as unknown as FeedbackRecord;
  });
  return NextResponse.json({ ok: true, feedbacks });
}

export async function POST(req: Request) {
  let body: Partial<FeedbackRecord>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const izoh = String(body.izoh ?? "").trim().slice(0, 2000);
  if (!izoh) {
    return NextResponse.json({ ok: false, error: "Izohni kiriting" }, { status: 400 });
  }
  if (!isFeedbackType(body.type)) {
    return NextResponse.json({ ok: false, error: "Fikr turini tanlang" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const col = db.collection("feedback");
  const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();

  const feedback: FeedbackRecord = {
    id: (last[0]?.id ?? 0) + 1,
    filial: String(body.filial ?? "").trim(),
    from: String(body.from ?? "").trim(),
    name: String(body.name ?? "").trim(),
    phone: String(body.phone ?? "").trim(),
    type: body.type,
    izoh,
    createdAt: nowStamp(),
    // 34-qism: holat, mas'ul, o'quvchi, manba (yangi versiyadagi «Fikr qo'shish» oynasi).
    status: "yangi",
    assignee: String(body.assignee ?? "").trim(),
    resolution: "",
    resolvedAt: null,
    pupilId: Number.isFinite(Number(body.pupilId)) && body.pupilId !== null ? Number(body.pupilId) : null,
    pupilName: String(body.pupilName ?? "").trim(),
    source: String(body.source ?? "").trim() || "Admin yozdi",
    createdBy: await currentAuthorName(),
  };
  // insertOne argumentga _id qo'shib yuboradi — nusxa yozamiz.
  await col.insertOne({ ...feedback });

  return NextResponse.json({ ok: true, feedback });
}

// PATCH {id, status?, assignee?, resolution?} — holat va mas'ul (yangi versiya, 34-qism).
export async function PATCH(req: Request) {
  let body: { id?: unknown; status?: unknown; assignee?: unknown; resolution?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }
  const id = Number(body.id);
  if (!Number.isFinite(id)) return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  const set: Record<string, unknown> = {};
  if (body.status !== undefined) {
    if (!FEEDBACK_STATUSES.includes(body.status as FeedbackStatus)) return NextResponse.json({ ok: false, error: "Noto'g'ri holat" }, { status: 400 });
    set.status = body.status;
    set.resolvedAt = body.status === "hal" ? nowStamp() : null;
  }
  if (typeof body.assignee === "string") set.assignee = body.assignee.trim();
  if (typeof body.resolution === "string") set.resolution = body.resolution.trim().slice(0, 500);
  const db = await ensureIndexes();
  const res = await db.collection("feedback").findOneAndUpdate({ id }, { $set: set }, { returnDocument: "after", projection: { _id: 0 } });
  if (!res) return NextResponse.json({ ok: false, error: "Fikr topilmadi" }, { status: 404 });
  return NextResponse.json({ ok: true, feedback: res });
}
