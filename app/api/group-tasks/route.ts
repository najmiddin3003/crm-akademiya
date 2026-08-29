import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import { formatDeadline, type GroupTask } from "@/lib/groupTasks";
import { toUz } from "@/lib/uzTime";

// Barcha vazifalar (Guruh → Barcha vazifalar). Barcha guruhlar bo'ylab
// `group_tasks` kolleksiyasi (guruh detalidagi Topshiriqlar bilan bir xil
// manba). Bu yerda qo'shilgan vazifa guruhsiz bo'ladi (groupId=0).

function fmtNow(raw: Date): string {
  const d = toUz(raw);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} | ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export async function GET() {
  const db = await ensureIndexes();
  const rows = await db.collection("group_tasks").find({}).sort({ id: -1 }).toArray();
  const tasks = rows.map(({ _id, ...rest }) => rest as unknown as GroupTask);
  return NextResponse.json({ ok: true, tasks });
}

export async function POST(req: Request) {
  let body: Partial<GroupTask> & { deadline?: string; maxScore?: number | string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const name = (body.name || "").trim();
  if (!name) {
    return NextResponse.json({ ok: false, error: "Nomini kiriting" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const col = db.collection("group_tasks");
  const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  const nextId = (last[0]?.id ?? 0) + 1;

  const task: GroupTask = {
    id: nextId,
    groupId: Number(body.groupId) || 0,
    type: body.type || "Imtihon",
    name,
    deadline: formatDeadline(body.deadline || ""),
    teacher: body.teacher || "",
    groupName: body.groupName || "",
    maxScore: parseInt(String(body.maxScore ?? ""), 10) || 0,
    note: (body.note || "").trim(),
    fileName: (body.fileName || "").trim(),
    createdAt: fmtNow(new Date()),
  };
  await col.insertOne({ ...task });
  return NextResponse.json({ ok: true, task });
}
