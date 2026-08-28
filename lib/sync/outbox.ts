import type { Db } from "mongodb";
import { kindNotifiesTelegram } from "@/lib/sync/config";
import type { SyncEvent, SyncKind, SyncTask } from "@/lib/sync/types";

// `sync_outbox` — yetkazib berish navbati.
//
// Nega navbat kerak? To'lov bazaga yozilgan payt Google yoki Telegram
// javob bermasligi mumkin (internet uzildi, API limiti, bot bloklandi).
// Navbatsiz o'sha yozuv butunlay yo'qolar va buni HECH KIM SEZMASDI.
// Navbat bilan: vazifa `pending` bo'lib qoladi va keyingi imkoniyatda
// (yangi to'lov kelganda yoki kunlik cron'da) qayta yuboriladi.
//
// Bitta yozuvning har hodisasi (qo'shildi / bekor qilindi) ALOHIDA vazifa.
// Takrorlanmasligi `{kind, entryId, event}` bo'yicha unikal indeks bilan
// ta'minlanadi (lib/mongodb.ts).

export const OUTBOX = "sync_outbox";

/**
 * Qayta urinishlar oralig'i (daqiqada). Birinchi xatodan keyin tez, keyin
 * asta-sekin siyraklashadi — vaqtinchalik uzilish darhol tuzaladi, doimiy
 * nosozlik esa bekorga so'rov yog'dirmaydi.
 */
const BACKOFF_MINUTES = [1, 5, 30, 120, 360];

function backoffFor(attempts: number): string {
  const idx = Math.min(Math.max(attempts - 1, 0), BACKOFF_MINUTES.length - 1);
  return new Date(Date.now() + BACKOFF_MINUTES[idx] * 60_000).toISOString();
}

export interface EnqueueInput {
  kind: SyncKind;
  entryId: number;
  event: SyncEvent;
  /** `false` — eski/import qilingan yozuv: faqat Sheet, Telegram'siz. */
  notifyTelegram: boolean;
}

/**
 * Telegram bayrog'ining YAKUNIY qiymati. Chaqiruvchi `true` bersa ham,
 * guruhga chiqmaydigan oqim (xarajat, ko'chirma) uchun majburan
 * o'chiriladi — qoida bitta joyda, chaqiruv joylarida takrorlanmaydi.
 */
function telegramFlag(input: EnqueueInput): boolean {
  return input.notifyTelegram && kindNotifiesTelegram(input.kind);
}

/**
 * Vazifani navbatga qo'yadi. Xuddi shu hodisa allaqachon navbatda bo'lsa
 * (masalan bir tugma ikki marta bosildi) yangisi yaratilmaydi — upsert.
 *
 * HECH QACHON XATO OTMAYDI: bu funksiya to'lov yozish oqimidan
 * chaqiriladi va sinxronizatsiya muammosi kassani to'xtatib qo'ymasligi
 * kerak. Muammo bo'lsa `false` qaytadi va log'ga yoziladi.
 */
export async function enqueue(db: Db, input: EnqueueInput): Promise<boolean> {
  const now = new Date().toISOString();
  try {
    await db.collection(OUTBOX).updateOne(
      { kind: input.kind, entryId: input.entryId, event: input.event },
      {
        $setOnInsert: {
          kind: input.kind,
          entryId: input.entryId,
          event: input.event,
          notifyTelegram: telegramFlag(input),
          status: "pending",
          sheetDone: false,
          // Telegram kerak bo'lmasa darhol "bajarilgan" deb belgilanadi,
          // shunda vazifa faqat Sheet yozilishi bilan yopiladi.
          telegramDone: !telegramFlag(input),
          messageId: null,
          attempts: 0,
          lastError: null,
          nextAttemptAt: null,
          createdAt: now,
          updatedAt: now,
          doneAt: null,
        },
      },
      { upsert: true },
    );
    return true;
  } catch (e) {
    console.error("[sync] navbatga qo'shilmadi", input, e);
    return false;
  }
}

/** Bir nechta vazifani birdan navbatga qo'yish (backfill/import uchun). */
export async function enqueueMany(db: Db, inputs: EnqueueInput[]): Promise<number> {
  if (inputs.length === 0) return 0;
  const now = new Date().toISOString();
  const ops = inputs.map((input) => ({
    updateOne: {
      filter: { kind: input.kind, entryId: input.entryId, event: input.event },
      update: {
        $setOnInsert: {
          kind: input.kind,
          entryId: input.entryId,
          event: input.event,
          notifyTelegram: telegramFlag(input),
          status: "pending",
          sheetDone: false,
          telegramDone: !telegramFlag(input),
          messageId: null,
          attempts: 0,
          lastError: null,
          nextAttemptAt: null,
          createdAt: now,
          updatedAt: now,
          doneAt: null,
        },
      },
      upsert: true,
    },
  }));
  const res = await db.collection(OUTBOX).bulkWrite(ops, { ordered: false });
  return res.upsertedCount;
}

/**
 * Shu yozuvning YARATILGANI guruhga e'lon qilinganmi (yoki e'lon
 * qilinishi mo'ljallanganmi)?
 *
 * NEGA KERAK: bekor qilish xabari faqat guruh ALLAQACHON ko'rgan
 * to'lov haqida ma'noli. Bazadagi 25 561 yozuvning aksari edutizimdan
 * ko'chirilgan tarix — ular `logEntry` dan o'tmagan, ya'ni navbatga
 * umuman tushmagan va guruhga hech qachon e'lon qilinmagan. 2025-yilgi
 * to'lovni bekor qilganda guruhga "BEKOR QILINDI" degan xabar ketsa,
 * odamlar ko'rmagan to'lov haqida tuzatish olgan bo'lardi.
 *
 * Sana chegarasi yoki `imported` bayrog'i o'rniga shu usul tanlandi:
 * u qo'shimcha maydon ham, migratsiya ham, sehrli sana ham talab
 * qilmaydi — javob navbatning o'zida turibdi.
 *
 * MUHIM: bu `sync_outbox` dagi bajarilgan (`done`) yozuvlar SAQLANIB
 * qolishiga tayanadi. Kelajakda navbatni tozalash qo'shilsa, `created`
 * hodisalari o'chmasligi kerak — aks holda eski to'lovni bekor qilish
 * yana jimgina guruhga chiqib ketadi.
 */
export async function wasAnnounced(db: Db, kind: SyncKind, entryId: number): Promise<boolean> {
  const doc = await db
    .collection(OUTBOX)
    .findOne({ kind, entryId, event: "created", notifyTelegram: true }, { projection: { _id: 1 } });
  return doc !== null;
}

/**
 * Yuborishga tayyor vazifalar: hali bajarilmagan va kutish vaqti o'tgan.
 * Eng eskisidan boshlab — to'lovlar guruhga qaysi tartibda bo'lgan bo'lsa,
 * shu tartibda tushsin.
 */
export async function claimPending(db: Db, limit: number): Promise<SyncTask[]> {
  const now = new Date().toISOString();
  const rows = await db
    .collection(OUTBOX)
    .find({
      status: { $in: ["pending", "failed"] },
      $or: [{ nextAttemptAt: null }, { nextAttemptAt: { $lte: now } }],
    })
    .sort({ entryId: 1, createdAt: 1 })
    .limit(limit)
    .toArray();
  return rows.map(({ _id, ...rest }) => rest as unknown as SyncTask);
}

export interface TaskOutcome {
  sheetDone: boolean;
  telegramDone: boolean;
  messageId: number | null;
  error: string | null;
}

/**
 * Urinish natijasini yozadi. Ikkala tomon ham bajarilgan bo'lsa vazifa
 * yopiladi; qisman bajarilgan bo'lsa (masalan Sheet yozildi, Telegram
 * yo'q) — bajarilgani ESLAB QOLINADI va keyingi urinishda faqat qolgani
 * takrorlanadi. Shu bilan dublikat qator/xabar paydo bo'lmaydi.
 */
export async function recordOutcome(
  db: Db,
  task: Pick<SyncTask, "kind" | "entryId" | "event" | "attempts">,
  outcome: TaskOutcome,
): Promise<void> {
  const now = new Date().toISOString();
  const finished = outcome.sheetDone && outcome.telegramDone;
  const attempts = task.attempts + 1;

  await db.collection(OUTBOX).updateOne(
    { kind: task.kind, entryId: task.entryId, event: task.event },
    {
      $set: {
        status: finished ? "done" : "failed",
        sheetDone: outcome.sheetDone,
        telegramDone: outcome.telegramDone,
        messageId: outcome.messageId,
        attempts,
        lastError: finished ? null : outcome.error,
        nextAttemptAt: finished ? null : backoffFor(attempts),
        updatedAt: now,
        doneAt: finished ? now : null,
      },
    },
  );
}

export interface OutboxCounts {
  pending: number;
  failed: number;
  done: number;
  /** Eng eski bajarilmagan vazifa vaqti — "qachondan beri osilib turibdi". */
  oldestPendingAt: string | null;
}

export async function outboxCounts(db: Db): Promise<OutboxCounts> {
  const col = db.collection(OUTBOX);
  const [pending, failed, done, oldest] = await Promise.all([
    col.countDocuments({ status: "pending" }),
    col.countDocuments({ status: "failed" }),
    col.countDocuments({ status: "done" }),
    col.find({ status: { $in: ["pending", "failed"] } }).sort({ createdAt: 1 }).limit(1).toArray(),
  ]);
  return {
    pending,
    failed,
    done,
    oldestPendingAt: oldest[0] ? String(oldest[0].createdAt) : null,
  };
}

/** CRM sahifasidagi jadval uchun — muammoli vazifalar ro'yxati. */
export async function listProblems(db: Db, limit = 50): Promise<SyncTask[]> {
  const rows = await db
    .collection(OUTBOX)
    .find({ status: { $in: ["pending", "failed"] } })
    .sort({ attempts: -1, createdAt: 1 })
    .limit(limit)
    .toArray();
  return rows.map(({ _id, ...rest }) => rest as unknown as SyncTask);
}

/**
 * Kutish vaqtini bekor qiladi — "Hozir qayta yubor" tugmasi uchun.
 * Foydalanuvchi tugmani bosgan ekan, 6 soat kutishning ma'nosi yo'q.
 */
export async function resetBackoff(db: Db): Promise<number> {
  const res = await db
    .collection(OUTBOX)
    .updateMany(
      { status: { $in: ["pending", "failed"] } },
      { $set: { nextAttemptAt: null, updatedAt: new Date().toISOString() } },
    );
  return res.modifiedCount;
}
