import type { Db } from "mongodb";
import { uzNow } from "@/lib/uzTime";

// O'QUVCHI IZOHLARI (29.09.2026) — guruh sahifasidagi «Izoh» tugmasi
// (o'ng-pastki burchakdagi oyna, components/orders/OrderMessagePanel.tsx) va
// o'quvchilar jadvalidagi «Oxirgi izoh» ustuni.
//
// NEGA ALOHIDA KOLLEKSIYA, `pupils.comments` EMAS: lid izohlari lid
// hujjatining ichida (app/api/orders/[id]/comments), lekin o'quvchilar
// ro'yxatlari (~7 000 hujjat) ko'p joyda proyeksiyasiz o'qiladi — izohlar
// massivi har bir ro'yxat javobiga qo'shilib ketardi.
//
// Kirish — o'quvchining o'zi kabi FILIAL QAMROVIDA (`withPupilBranch`,
// app/api/pupils/[id]): boshqa filial o'quvchisiga izoh yozib ham, o'qib ham
// bo'lmaydi.

export const PUPIL_COMMENTS = "pupil_comments";

export interface PupilComment {
  id: number;
  pupilId: number;
  text: string;
  /** "YYYY-MM-DD" — Toshkent kuni. */
  date: string;
  /** "HH:mm" */
  time: string;
  /** Yozgan xodim (users.fullName). */
  by: string;
  createdAt: Date;
}

/** Mijozga boradigan ko'rinish. */
export interface PupilCommentView {
  text: string;
  date: string;
  time: string;
  by: string;
}

export const commentView = (c: PupilComment): PupilCommentView => ({ text: c.text, date: c.date, time: c.time, by: c.by });

/** Izoh matnining chegarasi — oyna uchun yetarli, bazani to'ldirib yubormaydi. */
export const MAX_COMMENT_LEN = 2000;

export type AddCommentOutcome =
  | { ok: true; comment: PupilComment }
  | { ok: false; error: string; status: 400 | 503 };

/**
 * Izoh qo'shadi. Filial qamrovini CHAQIRUVCHI tekshiradi
 * (app/api/pupils/[id]/comments, lib/ai/actions/execute.ts) — bu yerda
 * faqat yozuv. `by` — yozgan xodim (users.fullName).
 */
export async function addPupilComment(db: Db, input: { pupilId: number; text: string; by: string }): Promise<AddCommentOutcome> {
  const text = input.text.trim().slice(0, MAX_COMMENT_LEN);
  if (!text) return { ok: false, error: "Izoh matnini kiriting", status: 400 };

  const now = uzNow();
  const pad = (n: number) => String(n).padStart(2, "0");
  const col = db.collection<PupilComment>(PUPIL_COMMENTS);
  // `id` — eng kattasidan keyingisi (loyihadagi naqsh); bir lahzada ikki xodim
  // yozsa ikkinchisi noyob indeksga urilib qayta oladi.
  for (let attempt = 0; attempt < 5; attempt++) {
    const [last] = await col.find({}, { projection: { _id: 0, id: 1 } }).sort({ id: -1 }).limit(1).toArray();
    const comment: PupilComment = {
      id: (Number(last?.id) || 0) + 1,
      pupilId: input.pupilId,
      text,
      date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
      time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
      by: input.by.trim(),
      createdAt: new Date(),
    };
    try {
      await col.insertOne({ ...comment });
      return { ok: true, comment };
    } catch (e) {
      if ((e as { code?: number } | null)?.code !== 11000) throw e;
    }
  }
  return { ok: false, error: "Hozir band — qayta urinib ko'ring", status: 503 };
}

/** Har bir o'quvchining ENG OXIRGI izohi (guruh jadvali uchun, bitta so'rovda). */
export async function lastCommentsFor(db: Db, pupilIds: number[]): Promise<Record<number, PupilCommentView>> {
  if (pupilIds.length === 0) return {};
  const rows = await db
    .collection<PupilComment>(PUPIL_COMMENTS)
    .aggregate<{ _id: number; last: PupilComment }>([
      { $match: { pupilId: { $in: pupilIds } } },
      { $sort: { createdAt: -1, id: -1 } },
      { $group: { _id: "$pupilId", last: { $first: "$$ROOT" } } },
    ])
    .toArray();
  const out: Record<number, PupilCommentView> = {};
  for (const r of rows) out[r._id] = commentView(r.last);
  return out;
}
