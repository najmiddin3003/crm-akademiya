import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ensureIndexes } from "@/lib/mongodb";
import {
  FINES_COL,
  TASKS_COL,
  TEXT_MAX,
  TITLE_MAX,
  batchSizes,
  cleanDeadline,
  cleanFiles,
  cleanLink,
  cleanPriority,
  cleanText,
  fineFor,
  fineInfo,
  insertWithNextId,
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
import type { StaffTask, StaffTaskEvent, StaffTasksPayload } from "@/lib/staffTasks";

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
// BIRIGA ALOHIDA topshiriq yaratiladi (o'z holati, o'z jarimasi bilan) va
// ular bitta `batchId` bilan bog'lanadi ("3 xodimga berilgan").
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
  if (v.role === "xodim") return bad("Topshiriq berish uchun ruxsatingiz yo'q", 403);

  const nowMs = Date.now();
  const title = cleanText(body.title, TITLE_MAX);
  if (!title) return bad("Sarlavhani kiriting");
  const desc = cleanText(body.desc, TEXT_MAX);
  const deadline = cleanDeadline(body.deadline, nowMs);
  if (!deadline) return bad("Deadline hozirgi vaqtdan keyin bo'lishi kerak");
  const priority = cleanPriority(body.priority);
  if (!priority) return bad("Muhimlik darajasini tanlang");
  const link = cleanLink(body.link);
  if (link === null) return bad("Havola http:// yoki https:// bilan boshlanishi kerak");
  const attachments = cleanFiles(body.attachments);
  if (attachments === null) return bad("Biriktirma yaroqsiz — faylni qaytadan yuklang");

  const ids = Array.isArray(body.employeeIds) ? [...new Set(body.employeeIds.map(Number).filter(Number.isFinite))] : [];
  if (!ids.length) return bad("Kamida bitta xodim tanlang");
  if (ids.length > 100) return bad("Bir martada ko'pi bilan 100 ta xodim");

  // Faqat QAMROVDAGI faol xodimlar: rahbar boshqa filial xodimiga
  // topshiriq bera olmaydi (ro'yxat ham shu funksiyadan chiziladi).
  const [pickable, settings] = await Promise.all([loadPickableEmployees(db, v), loadSettings(db)]);
  const byId = new Map(pickable.map((e) => [e.id, e]));
  const chosen = ids.map((id) => byId.get(id));
  if (chosen.some((e) => !e)) return bad("Tanlangan xodim ro'yxatda yo'q — sahifani yangilang");

  const nowIso = new Date(nowMs).toISOString();
  const fineAmount = fineFor(settings, priority);
  const created: StaffTaskDoc[] = [];
  let batchId = 0;
  for (const emp of chosen) {
    if (!emp) continue;
    const ev: StaffTaskEvent = { at: nowIso, kind: "created", by: v.name, byUserId: v.userId, deadline, priority };
    const doc = await insertWithNextId<StaffTaskDoc>(db, TASKS_COL, (id) => ({
      id,
      // To'plam raqami — birinchi topshiriqning o'z raqami.
      batchId: batchId || id,
      title,
      desc,
      employeeId: emp.id,
      employeeName: emp.name,
      branchId: emp.branchId,
      priority,
      fineAmount,
      deadline,
      originalDeadline: deadline,
      redeadline: null,
      attachments,
      link,
      seenAt: null,
      doneAt: null,
      doneNote: "",
      resultLink: "",
      resultFile: null,
      isLate: false,
      status: "yangi",
      returnCount: 0,
      cancelReason: "",
      completedAt: null,
      completedLate: false,
      failedAt: null,
      createdBy: { userId: v.userId, employeeId: v.employeeId, name: v.name },
      createdAt: nowIso,
      updatedAt: nowIso,
      history: [ev],
    }));
    if (!batchId) batchId = doc.id;
    created.push(doc);
  }

  const tasks: StaffTask[] = created.map((d) => toClientTask(d, v, { batchSize: created.length }));
  return NextResponse.json({ ok: true, tasks });
}
