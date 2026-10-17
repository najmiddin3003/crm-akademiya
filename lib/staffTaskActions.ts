import type { Db } from "mongodb";
import {
  TASKS_COL,
  TEXT_MAX,
  canManage,
  cleanDeadline,
  cleanFile,
  cleanLink,
  cleanText,
  isActiveStatus,
  isAssignee,
  type StaffTaskDoc,
  type StaffTaskViewer,
} from "@/lib/staffTasksServer";
import { OPEN_STATUSES, ms, type StaffTaskEvent } from "@/lib/staffTasks";

// XODIM TOPSHIRIQLARI — AMALLAR YADROSI (17.10.2026 da
// app/api/staff-tasks/[id]/route.ts dan ko'chirildi, mazmuni o'zgarmagan):
//   done (ijrochi) | approve | return | cancel (rahbar) va «Ko'rildi».
//
// NEGA ALOHIDA: shu amallarni endi xodimlar boti ham bajaradi
// (lib/staffBot/tasks.ts). Qoida ikki joyda yozilsa vaqt o'tib farq qilib
// qolardi — masalan botda izohsiz qaytarib bo'ladigan bo'lib qolardi.
//
// Chaqiruvchi avval avtomatikani majburiy yuritadi (runAutomation force) —
// muddati o'tib ketgan topshiriqqa «Bajardim» bosilsa u avval to'g'ri
// holatga o'tsin. Yozuv HOLAT SHARTI bilan (`status` + eski qiymat): ikki
// joydan bir vaqtda bosilgan amal bir-birini jimgina bosib ketmaydi — 409.

export const STALE = "Topshiriq holati o'zgargan — sahifani yangilab qayta urinib ko'ring";

export type StaffTaskAction = "done" | "approve" | "return" | "cancel";

export type StaffTaskActionResult =
  | { ok: true; action: StaffTaskAction; event: StaffTaskEvent }
  | { ok: false; status: 400 | 403 | 409; error: string };

/**
 * Amalni bajaradi. `input` — web'dagi so'rov tanasi bilan bir xil maydonlar:
 * done → note, link, file; return → note, deadline; cancel → reason.
 */
export async function applyStaffTaskAction(
  db: Db,
  v: StaffTaskViewer,
  doc: StaffTaskDoc,
  action: string,
  input: Record<string, unknown>,
  nowMs = Date.now(),
): Promise<StaffTaskActionResult> {
  const bad = (error: string, status: 400 | 403 | 409 = 400): StaffTaskActionResult => ({ ok: false, status, error });
  const nowIso = new Date(nowMs).toISOString();
  const col = db.collection<StaffTaskDoc>(TASKS_COL);
  const taskId = doc.id;
  const base = { at: nowIso, by: v.name, byUserId: v.userId };

  if (action === "done") {
    if (!isAssignee(v, doc)) return bad("«Bajardim» ni faqat topshiriq berilgan xodim bosadi", 403);
    if (!isActiveStatus(doc.status)) return bad("Bu topshiriq allaqachon yopilgan yoki tasdiq kutmoqda");
    const note = cleanText(input.note, TEXT_MAX);
    const link = cleanLink(input.link);
    if (link === null) return bad("Havola http:// yoki https:// bilan boshlanishi kerak");
    const file = input.file == null ? null : cleanFile(input.file);
    if (input.file != null && !file) return bad("Fayl yaroqsiz — qaytadan yuklang");
    // Deadline o'tgach, lekin qayta muddat ichida — "kechikib bajarildi",
    // jarima yozilmaydi. Qayta muddat o'tgan bo'lsa avtomatika topshiriqni
    // allaqachon «Bajarilmadi» ga o'tkazgan (chaqiruvchi majburiy yuritadi).
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
    return { ok: true, action, event: ev };
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
    return { ok: true, action, event: ev };
  }

  if (action === "return") {
    if (doc.status !== "tasdiq_kutilmoqda") return bad("Faqat tasdiq kutayotgan topshiriq qaytariladi");
    const note = cleanText(input.note, TEXT_MAX);
    if (!note) return bad("Nimani to'g'rilash kerakligini yozing");
    const deadline = cleanDeadline(input.deadline, nowMs);
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
    return { ok: true, action, event: ev };
  }

  if (action === "cancel") {
    if (!OPEN_STATUSES.includes(doc.status)) return bad("Yopilgan topshiriqni bekor qilib bo'lmaydi");
    const reason = cleanText(input.reason, TEXT_MAX);
    if (!reason) return bad("Bekor qilish sababini yozing");
    const ev: StaffTaskEvent = { ...base, kind: "cancelled", text: reason };
    const res = await col.updateOne(
      { id: taskId, status: doc.status },
      { $set: { status: "bekor", cancelReason: reason, updatedAt: nowIso }, $push: { history: ev } },
    );
    if (!res.modifiedCount) return bad(STALE, 409);
    return { ok: true, action, event: ev };
  }

  return bad("Noma'lum amal");
}

/**
 * Ijrochi topshiriqni birinchi marta ochdi — «Ko'rildi» (rahbar "xodim hali
 * ochmagan" belgisini shundan ko'radi). Faqat ijrochiga, bir marta.
 */
export async function markStaffTaskSeen(db: Db, v: StaffTaskViewer, doc: StaffTaskDoc, nowMs = Date.now()): Promise<void> {
  if (!isAssignee(v, doc) || doc.seenAt) return;
  const nowIso = new Date(nowMs).toISOString();
  const ev: StaffTaskEvent = { at: nowIso, kind: "seen", by: v.name, byUserId: v.userId };
  await db
    .collection<StaffTaskDoc>(TASKS_COL)
    .updateOne({ id: doc.id, seenAt: null }, { $set: { seenAt: nowIso }, $push: { history: ev } });
}
