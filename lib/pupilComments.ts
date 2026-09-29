import type { Db } from "mongodb";

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
