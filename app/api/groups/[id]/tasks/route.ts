import { NextResponse } from "next/server";
import { ensureIndexes } from "@/lib/mongodb";
import type { Group } from "@/lib/groups";
import type { GroupTask } from "@/lib/groupTasks";

// "2026-07-15T14:00" → "15.07.2026 | 14:00"
function fmtDeadline(v?: string): string {
  if (!v) return "";
  const [date, time] = v.split("T");
  const [y, m, d] = (date || "").split("-");
  if (!y || !m || !d) return v;
  return `${d}.${m}.${y}${time ? ` | ${time}` : ""}`;
}

function fmtNow(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} | ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// GET /api/groups/:id/tasks — guruh topshiriqlari.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  const db = await ensureIndexes();
  const rows = await db.collection("group_tasks").find({ groupId }).sort({ id: -1 }).toArray();
  const tasks = rows.map(({ _id, ...rest }) => rest as unknown as GroupTask);
  return NextResponse.json({ ok: true, tasks });
}

// POST /api/groups/:id/tasks — yangi topshiriq (o'qituvchi/guruh nomi guruhdan olinadi).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isFinite(groupId)) {
    return NextResponse.json({ ok: false, error: "Noto'g'ri id" }, { status: 400 });
  }
  let body: { type?: string; name?: string; deadline?: string; maxScore?: number | string; note?: string; fileName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Noto'g'ri so'rov" }, { status: 400 });
  }

  const name = (body.name || "").trim();
  if (!name) {
    return NextResponse.json({ ok: false, error: "Topshiriq nomini kiriting" }, { status: 400 });
  }

  const db = await ensureIndexes();
  const group = await db.collection<Group>("groups").findOne({ id: groupId });
  if (!group) {
    return NextResponse.json({ ok: false, error: "Guruh topilmadi" }, { status: 404 });
  }

  const col = db.collection("group_tasks");
  const last = await col.find({}).sort({ id: -1 }).limit(1).toArray();
  const nextId = (last[0]?.id ?? 0) + 1;

  const task: GroupTask = {
    id: nextId,
    groupId,
    type: body.type || "Vazifa",
    name,
    deadline: fmtDeadline(body.deadline),
    teacher: group.teacher || "",
    groupName: group.name || String(groupId),
    maxScore: parseInt(String(body.maxScore ?? ""), 10) || 0,
    note: (body.note || "").trim(),
    fileName: (body.fileName || "").trim(),
    createdAt: fmtNow(new Date()),
  };
  await col.insertOne({ ...task });
  return NextResponse.json({ ok: true, task });
}
