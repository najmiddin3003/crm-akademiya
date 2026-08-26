import type { Db } from "mongodb";
import type { ReconcileReport, SyncRunDoc } from "@/lib/sync/types";

// `sync_runs` — har bir tekshiruvning izi. Kelishuv bo'yicha natija
// Telegram'ga YUBORILMAYDI, faqat CRM ichidagi "Sinxronizatsiya"
// sahifasida ko'rinadi.
//
// Nega saqlaymiz? "Kecha tekshiruv o'tganmi, nechta yozuv tuzatilgan?"
// degan savolga javob bo'lishi kerak. Aks holda modul jimgina buzilib
// tursa ham hech kim bilmaydi.

export const RUNS = "sync_runs";

/** Oxirgi 100 ta yugurish saqlanadi — undan eskisi tozalanadi. */
const KEEP_RUNS = 100;

async function nextId(db: Db): Promise<number> {
  const last = await db.collection(RUNS).find({}).sort({ id: -1 }).limit(1).toArray();
  return (Number(last[0]?.id) || 0) + 1;
}

export async function startRun(db: Db, trigger: "cron" | "manual"): Promise<number> {
  const id = await nextId(db);
  const doc: SyncRunDoc = {
    id,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    trigger,
    flushed: 0,
    flushFailed: 0,
    reports: [],
    ok: false,
    error: null,
  };
  await db.collection(RUNS).insertOne(doc);
  return id;
}

export async function finishRun(
  db: Db,
  id: number,
  data: { flushed: number; flushFailed: number; reports: ReconcileReport[]; error?: string | null },
): Promise<void> {
  const hasErrors =
    Boolean(data.error) || data.reports.some((r) => r.errors.length > 0) || data.flushFailed > 0;
  await db.collection(RUNS).updateOne(
    { id },
    {
      $set: {
        finishedAt: new Date().toISOString(),
        flushed: data.flushed,
        flushFailed: data.flushFailed,
        reports: data.reports,
        ok: !hasErrors,
        error: data.error ?? null,
      },
    },
  );

  // Eski yozuvlarni tozalash — jurnal cheksiz o'smasin.
  const old = await db
    .collection(RUNS)
    .find({}, { projection: { id: 1 } })
    .sort({ id: -1 })
    .skip(KEEP_RUNS)
    .toArray();
  if (old.length > 0) {
    await db.collection(RUNS).deleteMany({ id: { $in: old.map((r) => Number(r.id)) } });
  }
}

export async function latestRuns(db: Db, limit = 10): Promise<SyncRunDoc[]> {
  const rows = await db.collection(RUNS).find({}).sort({ id: -1 }).limit(limit).toArray();
  return rows.map(({ _id, ...rest }) => rest as unknown as SyncRunDoc);
}
