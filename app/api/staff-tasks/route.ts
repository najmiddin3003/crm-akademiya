import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ensureIndexes } from "@/lib/mongodb";
import {
  FINES_COL,
  TASKS_COL,
  batchSizes,
  createStaffTasks,
  fineInfo,
  loadBranches,
  loadClosedMonths,
  loadPickableEmployees,
  loadSettings,
  loadViewer,
  runAutomation,
  taskScope,
  toClientTask,
  viewerInfo,
  type StaffFineDoc,
  type StaffTaskDoc,
} from "@/lib/staffTasksServer";
import type { StaffTask, StaffTasksPayload } from "@/lib/staffTasks";

// XODIM TOPSHIRIQLARI (/tasks) — ro'yxat va yangi topshiriq.
//
// QAMROV SHU YERDA kesiladi (lib/staffTasksServer.ts → taskScope): route
// gen-api-permissions'da SHARED_EXTRA da, chunki sahifa hammaga ochiq —
// oddiy xodim ham o'z topshirig'ini shu yerdan oladi.
//
// Ro'yxatga `history` KIRMAYDI (u batafsil oynada — GET /api/staff-tasks/:id):
// yuzlab topshiriqda tarix massivlari javobni bir necha barobar og'irlashtirardi.

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

export async function GET() {
  const me = await getCurrentUser();
  if (!me) return bad("Tizimga kirmagansiz", 401);
  const db = await ensureIndexes();
  await runAutomation(db);
  const v = await loadViewer(db, me);

  const [settings, branches, employees, docs, closed] = await Promise.all([
    loadSettings(db),
    loadBranches(db),
    loadPickableEmployees(db, v),
    db.collection<StaffTaskDoc>(TASKS_COL).find(taskScope(v), { projection: { _id: 0, history: 0 } }).toArray(),
    loadClosedMonths(db),
  ]);

  const failedIds = docs.filter((d) => d.status === "bajarilmadi").map((d) => d.id);
  const [sizes, fines] = await Promise.all([
    batchSizes(db, docs.filter((d) => d.batchId).map((d) => d.batchId)),
    failedIds.length
      ? db.collection<StaffFineDoc>(FINES_COL).find({ taskId: { $in: failedIds } }, { projection: { _id: 0 } }).toArray()
      : Promise.resolve([] as StaffFineDoc[]),
  ]);
  const fineByTask = new Map(fines.map((f) => [f.taskId, f]));

  const payload: StaffTasksPayload = {
    ok: true,
    serverNow: new Date().toISOString(),
    viewer: viewerInfo(v),
    branches,
    employees,
    settings,
    tasks: docs.map((d) =>
      toClientTask(d as StaffTaskDoc, v, {
        batchSize: sizes.get(d.batchId) ?? 1,
        fine: fineInfo(fineByTask.get(d.id), closed),
      }),
    ),
  };
  return NextResponse.json(payload);
}

// POST /api/staff-tasks — yangi topshiriq. Bir nechta xodim tanlansa HAR
// BIRIGA ALOHIDA topshiriq yaratiladi. Butun mantiq (tekshiruv, qamrov,
// jarima, batchId) lib/staffTasksServer.ts → createStaffTasks da — AI
// yordamchi ham o'sha yadrodan o'tadi.
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
  const v = await loadViewer(db, me);
  const out = await createStaffTasks(db, v, body);
  if (!out.ok) return bad(out.error, out.status);

  const tasks: StaffTask[] = out.docs.map((d) => toClientTask(d, v, { batchSize: out.docs.length }));
  return NextResponse.json({ ok: true, tasks });
}
