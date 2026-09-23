import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ensureIndexes } from "@/lib/mongodb";
import {
  FINES_COL,
  TASKS_COL,
  TEXT_MAX,
  cleanText,
  fineInfo,
  loadClosedMonths,
  loadViewer,
  syncFinePenalties,
  type StaffFineDoc,
  type StaffTaskDoc,
} from "@/lib/staffTasksServer";
import type { StaffTaskEvent, StaffTaskFine } from "@/lib/staffTasks";

// POST /api/staff-tasks/fines/:id — jarimani BEKOR QILISH (faqat direktor).
//
// Yozuv o'chmaydi: holat "bekor" + sabab, topshiriq tarixiga yoziladi va
// xodim ko'radi. Moliya → Jarima dagi yozuv ham "cancelled" ga o'tadi va
// shu oydagi qolgan jarimalar limit bo'yicha qayta taqsimlanadi
// (syncFinePenalties) — bittasi bekor bo'lsa, limitdan oshib qolgani endi
// ushlanishi mumkin.
//
// Oyligi CHIQARILGAN oyning jarimasi bekor qilinmaydi — hisob yopilgan.

type Ctx = { params: Promise<{ id: string }> };
const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: Request, ctx: Ctx) {
  const me = await getCurrentUser();
  if (!me) return bad("Tizimga kirmagansiz", 401);
  const { id } = await ctx.params;
  const fineId = Number(id);
  if (!Number.isFinite(fineId)) return bad("Noto'g'ri id");

  const db = await ensureIndexes();
  const v = await loadViewer(db, me);
  if (v.role !== "direktor") return bad("Jarimani faqat direktor bekor qiladi", 403);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return bad("Noto'g'ri so'rov");
  }
  const reason = cleanText(body.reason, TEXT_MAX);
  if (!reason) return bad("Bekor qilish sababini yozing");

  const col = db.collection<StaffFineDoc>(FINES_COL);
  const fine = await col.findOne({ id: fineId }, { projection: { _id: 0 } });
  if (!fine) return bad("Jarima topilmadi", 404);
  if (fine.status !== "kuchda") return bad("Jarima allaqachon bekor qilingan");
  const closed = await loadClosedMonths(db);
  if (closed(fine.employeeId, fine.month)) {
    return bad("Bu oyning oyligi chiqarilgan — jarimani bekor qilib bo'lmaydi");
  }

  const nowIso = new Date().toISOString();
  const res = await col.updateOne(
    { id: fineId, status: "kuchda" },
    { $set: { status: "bekor", cancelReason: reason, cancelledBy: v.name, cancelledAt: nowIso } },
  );
  if (!res.modifiedCount) return bad("Jarima holati o'zgargan — sahifani yangilang", 409);

  const ev: StaffTaskEvent = { at: nowIso, kind: "fine_cancelled", by: v.name, byUserId: v.userId, text: reason, amount: fine.amount };
  await db.collection<StaffTaskDoc>(TASKS_COL).updateOne({ id: fine.taskId }, { $push: { history: ev }, $set: { updatedAt: nowIso } });
  await syncFinePenalties(db, fine.employeeId, fine.month);

  const after = await col.findOne({ id: fineId }, { projection: { _id: 0 } });
  if (!after) return bad("Jarima topilmadi", 404);
  const out: StaffTaskFine = {
    ...(fineInfo(after, closed) as NonNullable<ReturnType<typeof fineInfo>>),
    taskId: after.taskId,
    taskTitle: after.taskTitle,
    employeeId: after.employeeId,
    employeeName: after.employeeName,
    branchId: after.branchId,
    priority: after.priority,
    deadline: after.deadline,
    redeadline: after.redeadline,
    failedAt: after.failedAt,
    createdAt: after.createdAt,
  };
  return NextResponse.json({ ok: true, fine: out });
}
