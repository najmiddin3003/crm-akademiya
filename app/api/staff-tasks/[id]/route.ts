import { NextResponse } from "next/server";
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
  cleanFile,
  cleanFiles,
  cleanLink,
  cleanPriority,
  cleanText,
  fineFor,
  fineInfo,
  isActiveStatus,
  isAssignee,
  loadClosedMonths,
  loadSettings,
  loadViewer,
  runAutomation,
  toClientTask,
  type StaffFineDoc,
  type StaffTaskDoc,
  type StaffTaskViewer,
} from "@/lib/staffTasksServer";
import { OPEN_STATUSES, ms, type StaffTaskChange, type StaffTaskEvent, type StaffTaskStatus } from "@/lib/staffTasks";

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
const STALE = "Topshiriq holati o'zgargan — sahifani yangilab qayta urinib ko'ring";

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
  if (wantSeen && isAssignee(v, doc) && !doc.seenAt) {
    const nowIso = new Date().toISOString();
    const ev: StaffTaskEvent = { at: nowIso, kind: "seen", by: v.name, byUserId: v.userId };
    await db
      .collection<StaffTaskDoc>(TASKS_COL)
      .updateOne({ id: taskId, seenAt: null }, { $set: { seenAt: nowIso }, $push: { history: ev } });
  }
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

// POST — amallar.
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
  const action = String(body.action ?? "");
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const col = db.collection<StaffTaskDoc>(TASKS_COL);
  const base = { at: nowIso, by: v.name, byUserId: v.userId };

  if (action === "done") {
    if (!isAssignee(v, doc)) return bad("«Bajardim» ni faqat topshiriq berilgan xodim bosadi", 403);
    if (!isActiveStatus(doc.status)) return bad("Bu topshiriq allaqachon yopilgan yoki tasdiq kutmoqda");
    const note = cleanText(body.note, TEXT_MAX);
    const link = cleanLink(body.link);
    if (link === null) return bad("Havola http:// yoki https:// bilan boshlanishi kerak");
    const file = body.file == null ? null : cleanFile(body.file);
    if (body.file != null && !file) return bad("Fayl yaroqsiz — qaytadan yuklang");
    // Deadline o'tgach, lekin qayta muddat ichida — "kechikib bajarildi",
    // jarima yozilmaydi. Qayta muddat o'tgan bo'lsa avtomatika topshiriqni
    // allaqachon «Bajarilmadi» ga o'tkazgan (yuqorida majburiy yuritildi).
    const isLate = nowMs > ms(doc.deadline);
    const ev: StaffTaskEvent = { ...base, kind: "done", text: note, late: isLate };
    const res = await col.updateOne(
      { id: taskId, status: doc.status },
      {
        $set: {
          status: "tasdiq_kutilmoqda",
          doneAt: nowIso,
          isLate,
          doneNote: note,
          resultLink: link,
          resultFile: file,
          updatedAt: nowIso,
        },
        $push: { history: ev },
      },
    );
    if (!res.modifiedCount) return bad(STALE, 409);
    return respond(db, v, taskId);
  }

  if (!canManage(v, doc)) return bad("Bu amal uchun ruxsatingiz yo'q", 403);

  if (action === "approve") {
    if (doc.status !== "tasdiq_kutilmoqda") return bad("Faqat tasdiq kutayotgan topshiriq tasdiqlanadi");
    const ev: StaffTaskEvent = { ...base, kind: "approved", late: !!doc.isLate };
    const res = await col.updateOne(
      { id: taskId, status: "tasdiq_kutilmoqda" },
      { $set: { status: "yakunlandi", completedAt: nowIso, completedLate: !!doc.isLate, updatedAt: nowIso }, $push: { history: ev } },
    );
    if (!res.modifiedCount) return bad(STALE, 409);
    return respond(db, v, taskId);
  }

  if (action === "return") {
    if (doc.status !== "tasdiq_kutilmoqda") return bad("Faqat tasdiq kutayotgan topshiriq qaytariladi");
    const note = cleanText(body.note, TEXT_MAX);
    if (!note) return bad("Nimani to'g'rilash kerakligini yozing");
    const deadline = cleanDeadline(body.deadline, nowMs);
    if (!deadline) return bad("Yangi deadline hozirgi vaqtdan keyin bo'lishi kerak");
    const ev: StaffTaskEvent = { ...base, kind: "returned", text: note, deadline };
    const res = await col.updateOne(
      { id: taskId, status: "tasdiq_kutilmoqda" },
      {
        $set: {
          status: "qaytarildi",
          deadline,
          redeadline: null,
          isLate: false,
          doneAt: null,
          doneNote: "",
          resultLink: "",
          resultFile: null,
          updatedAt: nowIso,
        },
        $inc: { returnCount: 1 },
        $push: { history: ev },
      },
    );
    if (!res.modifiedCount) return bad(STALE, 409);
    return respond(db, v, taskId);
  }

  if (action === "cancel") {
    if (!OPEN_STATUSES.includes(doc.status)) return bad("Yopilgan topshiriqni bekor qilib bo'lmaydi");
    const reason = cleanText(body.reason, TEXT_MAX);
    if (!reason) return bad("Bekor qilish sababini yozing");
    const ev: StaffTaskEvent = { ...base, kind: "cancelled", text: reason };
    const res = await col.updateOne(
      { id: taskId, status: doc.status },
      { $set: { status: "bekor", cancelReason: reason, updatedAt: nowIso }, $push: { history: ev } },
    );
    if (!res.modifiedCount) return bad(STALE, 409);
    return respond(db, v, taskId);
  }

  return bad("Noma'lum amal");
}
