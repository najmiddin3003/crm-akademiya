import { NextResponse, after } from "next/server";
import type { Db } from "mongodb";
import { getCurrentUser } from "@/lib/auth";
import { ensureIndexes } from "@/lib/mongodb";
import {
  FILES_MAX,
  FINES_COL,
  TASKS_COL,
  TEXT_MAX,
  TITLE_MAX,
  batchSizes,
  canManage,
  canSee,
  cleanDeadline,
  cleanFiles,
  cleanLink,
  cleanPriority,
  cleanText,
  fineFor,
  fineInfo,
  isActiveStatus,
  loadClosedMonths,
  loadSettings,
  loadViewer,
  runAutomation,
  toClientTask,
  type StaffFineDoc,
  type StaffTaskDoc,
  type StaffTaskViewer,
} from "@/lib/staffTasksServer";
import { ms, type StaffTaskChange, type StaffTaskEvent, type StaffTaskStatus } from "@/lib/staffTasks";
import { applyStaffTaskAction, markStaffTaskSeen, STALE } from "@/lib/staffTaskActions";
import { notifyStaffTaskAction } from "@/lib/staffBot/taskNotify";

// Bitta topshiriq:
//   GET   — batafsil (tarix bilan). `?seen=1` va so'rovchi IJROCHI bo'lsa
//           birinchi ochilgani «Ko'rildi» deb yoziladi — rahbar "xodim hali
//           ochmagan" belgisini shundan ko'radi.
//   PATCH — tahrirlash (rahbar; xodim «Bajardim» bosgunga qadar).
//   POST  — amal: done (ijrochi) | approve | return | cancel (rahbar).
//
// Har amal oldidan avtomatika MAJBURIY yuritiladi: muddati allaqachon o'tib
// ketgan topshiriqqa «Bajardim» bosilsa, u avval to'g'ri holatga o'tsin.
// Yozuv HOLAT SHARTI bilan (`status` + eski qiymat) — ikki oynadan bir
// vaqtda bosilgan amal bir-birini jimgina bosib ketmaydi, 409 qaytadi.

type Ctx = { params: Promise<{ id: string }> };

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

async function respond(db: Db, v: StaffTaskViewer, id: number) {
  const d = await db.collection<StaffTaskDoc>(TASKS_COL).findOne({ id }, { projection: { _id: 0 } });
  if (!d) return bad("Topshiriq topilmadi", 404);
  const [sizes, fine, closed] = await Promise.all([
    batchSizes(db, [d.batchId]),
    db.collection<StaffFineDoc>(FINES_COL).findOne({ taskId: id }, { projection: { _id: 0 } }),
    loadClosedMonths(db),
  ]);
  const task = toClientTask(d as StaffTaskDoc, v, {
    batchSize: sizes.get(d.batchId) ?? 1,
    fine: fineInfo(fine, closed),
    withHistory: true,
  });
  return NextResponse.json({ ok: true, task });
}

/** `force` — amal oldidan: avtomatika 20 soniyalik tejamni kutmasin. */
async function load(ctx: Ctx, force: boolean) {
  const me = await getCurrentUser();
  if (!me) return { error: bad("Tizimga kirmagansiz", 401) } as const;
  const { id } = await ctx.params;
  const taskId = Number(id);
  if (!Number.isFinite(taskId)) return { error: bad("Noto'g'ri id") } as const;
  const db = await ensureIndexes();
  await runAutomation(db, { force });
  const v = await loadViewer(db, me);
  const doc = await db.collection<StaffTaskDoc>(TASKS_COL).findOne({ id: taskId }, { projection: { _id: 0 } });
  // Ko'rinmaydigan topshiriq — "topilmadi": boshqaning topshirig'i bor-yo'qligi ham oshkor bo'lmasin.
  if (!doc || !canSee(v, doc)) return { error: bad("Topshiriq topilmadi", 404) } as const;
  return { db, v, doc: doc as StaffTaskDoc, taskId } as const;
}

export async function GET(req: Request, ctx: Ctx) {
  const r = await load(ctx, false);
  if ("error" in r) return r.error;
  const { db, v, doc, taskId } = r;

  const wantSeen = new URL(req.url).searchParams.get("seen") === "1";
  if (wantSeen) await markStaffTaskSeen(db, v, doc);
  return respond(db, v, taskId);
}

// PATCH — tahrirlash. Xodim hali «Bajardim» bosmagan (faol) topshiriqda.
// Muddati o'tgan topshiriqqa yangi deadline qo'yilsa qayta muddat bekor
// bo'ladi va topshiriq yana "yangi"/"qaytarildi" holatiga qaytadi.
export async function PATCH(req: Request, ctx: Ctx) {
  const r = await load(ctx, true);
  if ("error" in r) return r.error;
  const { db, v, doc, taskId } = r;
  if (!canManage(v, doc)) return bad("Bu topshiriqni tahrirlash uchun ruxsatingiz yo'q", 403);
  if (!isActiveStatus(doc.status)) return bad("Xodim «Bajardim» bosgan yoki yopilgan topshiriqni tahrirlab bo'lmaydi");

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return bad("Noto'g'ri so'rov");
  }
  const nowMs = Date.now();
  const title = cleanText(body.title, TITLE_MAX);
  if (!title) return bad("Sarlavhani kiriting");
  const desc = cleanText(body.desc, TEXT_MAX);
  const priority = cleanPriority(body.priority);
  if (!priority) return bad("Muhimlik darajasini tanlang");
  const link = cleanLink(body.link);
  if (link === null) return bad("Havola http:// yoki https:// bilan boshlanishi kerak");
  // Biriktirmalar: mijoz mavjud fayllarning MANZILINI bilmaydi (u faqat
  // server orqali ochiladi), shuning uchun "qaysilari qolsin" — indekslar,
  // yangilari esa yuklash route'i qaytargan fayllar.
  const keepRaw = body.keepAttachments;
  const keep = Array.isArray(keepRaw) ? new Set(keepRaw.map(Number).filter((i) => Number.isInteger(i) && i >= 0)) : null;
  const kept = (doc.attachments ?? []).filter((_, i) => keep === null || keep.has(i));
  const added = cleanFiles(body.addAttachments);
  if (added === null) return bad("Biriktirma yaroqsiz — faylni qaytadan yuklang");
  const attachments = [...kept, ...added];
  if (attachments.length > FILES_MAX) return bad("Ko'pi bilan 10 ta fayl biriktiriladi");

  // Deadline o'zgarmagan bo'lsa (hatto o'tib ketgan bo'lsa ham) — tegilmaydi;
  // yangisi esa hozirdan keyin bo'lishi shart.
  const sameDeadline = Math.abs(ms(String(body.deadline ?? "")) - ms(doc.deadline)) < 60_000;
  const deadline = sameDeadline ? doc.deadline : cleanDeadline(body.deadline, nowMs);
  if (!deadline) return bad("Deadline hozirgi vaqtdan keyin bo'lishi kerak");
  if (doc.status === "muddati_otdi" && sameDeadline) {
    return bad("Muddati o'tgan topshiriqqa yangi deadline qo'ying");
  }

  const changes: StaffTaskChange[] = [];
  if (!sameDeadline) changes.push({ field: "deadline", from: doc.deadline, to: deadline });
  if (doc.priority !== priority) changes.push({ field: "priority", from: doc.priority, to: priority });
  if (doc.title !== title) changes.push({ field: "title" });
  if ((doc.desc ?? "") !== desc) changes.push({ field: "desc" });
  if ((doc.link ?? "") !== link) changes.push({ field: "link" });
  const filesKey = (xs: { url: string }[]) => xs.map((f) => f.url).join("|");
  if (filesKey(doc.attachments ?? []) !== filesKey(attachments)) changes.push({ field: "files" });

  const set: Partial<StaffTaskDoc> = { title, desc, link, attachments, deadline, priority, updatedAt: new Date(nowMs).toISOString() };
  // Summa topshiriq berilgan paytda yozib olinadi; muhimlik o'zgarsagina
  // bugungi sozlamadan qayta olinadi.
  if (doc.priority !== priority) set.fineAmount = fineFor(await loadSettings(db), priority);
  let status: StaffTaskStatus = doc.status;
  if (doc.status === "muddati_otdi") {
    status = doc.returnCount ? "qaytarildi" : "yangi";
    set.status = status;
    set.redeadline = null;
    changes.push({ field: "grace" });
  }
  if (!changes.length) return respond(db, v, taskId);

  const ev: StaffTaskEvent = {
    at: new Date(nowMs).toISOString(),
    kind: "edited",
    by: v.name,
    byUserId: v.userId,
    deadline,
    priority,
    changes,
  };
  const res = await db
    .collection<StaffTaskDoc>(TASKS_COL)
    .updateOne({ id: taskId, status: doc.status, deadline: doc.deadline }, { $set: set, $push: { history: ev } });
  if (!res.modifiedCount) return bad(STALE, 409);
  return respond(db, v, taskId);
}

// POST — amallar. Qoidalar lib/staffTaskActions.ts da (xodimlar boti ham
// o'shani chaqiradi). Muvaffaqiyatli amaldan keyin xodimlar botiga xabar:
// «Bajardim» — topshiriq berganga, qolganlari — ijrochiga
// (lib/staffBot/taskNotify.ts; javob ketgandan keyin, `after`).
export async function POST(req: Request, ctx: Ctx) {
  const r = await load(ctx, true);
  if ("error" in r) return r.error;
  const { db, v, doc, taskId } = r;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return bad("Noto'g'ri so'rov");
  }
  const out = await applyStaffTaskAction(db, v, doc, String(body.action ?? ""), body);
  if (!out.ok) return bad(out.error, out.status);
  after(() => notifyStaffTaskAction(db, taskId, out.action, out.event));
  return respond(db, v, taskId);
}
