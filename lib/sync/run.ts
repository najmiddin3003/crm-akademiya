import { ensureIndexes } from "@/lib/mongodb";
import { loadSyncConfig } from "@/lib/sync/config";
import { flushPending } from "@/lib/sync/dispatch";
import { reconcileAll } from "@/lib/sync/reconcile";
import { writeSalarySummary } from "@/lib/sync/salarySheet";
import { finishRun, startRun } from "@/lib/sync/runs";
import type { FlushResult } from "@/lib/sync/dispatch";
import type { ReconcileReport } from "@/lib/sync/types";

// To'liq sinxronizatsiya sikli — kunlik cron ham, CRM sahifasidagi
// "Hozir tekshirish" tugmasi ham SHU funksiyani chaqiradi. Mantiq bitta
// joyda tursin: aks holda tugma bilan cron boshqacha ish qilib qolardi.

export interface SyncCycleResult {
  runId: number;
  durationMs: number;
  flush: FlushResult;
  reports: ReconcileReport[];
}

/**
 * @param trigger  kim ishga tushirdi — jurnalda ko'rinadi
 * @param budgetMs shu vaqt ichida tugashi kerak (serverless cheklovi)
 */
export async function runSyncCycle(
  trigger: "cron" | "manual",
  budgetMs: number,
): Promise<SyncCycleResult> {
  const startedAt = Date.now();
  const db = await ensureIndexes();
  const runId = await startRun(db, trigger);

  try {
    // TARTIB MUHIM: avval navbat, keyin solishtirish.
    //
    // Navbatda turgan yozuv Sheet'da hali yo'q. Agar solishtirish oldin
    // ishlasa, u shu yozuvni "yetishmayapti" deb qo'shadi, keyin navbat
    // uni yana qo'shadi — natijada DUBLIKAT. Shuning uchun navbat oldin
    // bo'shatiladi.
    const flushBudget = Math.min(Math.floor(budgetMs * 0.4), 20_000);
    const flush = await flushPending(db, { limit: 200, deadline: startedAt + flushBudget });
    const reports = await reconcileAll(db, startedAt + budgetMs);

    // "Xodim oyliklari" — HISOBLANGAN oylik varag'i (lib/sync/salarySheet.ts).
    //
    // Solishtirishdan KEYIN: u yozuvlar jadvalini bazaga tenglaydi, oylik
    // esa o'sha yozuvlardan hisoblanadi. Teskari tartibda varaq bir sikl
    // eskirgan raqamni ko'rsatib turardi.
    //
    // Xatosi butun siklni yiqitmaydi — `writeSalarySummary` otmaydi,
    // nosozlikni hisobotga qaytaradi. To'lovlar solishtiruvi oylik
    // varag'idagi muammo tufayli to'xtab qolmasligi kerak.
    const salarySheet = await writeSalarySummary(db, loadSyncConfig(), new Date());
    if (salarySheet.errors.length > 0) {
      console.error("[sync] oylik varag'i:", salarySheet.errors.join("; "));
    }

    await finishRun(db, runId, {
      flushed: flush.succeeded,
      flushFailed: flush.failed,
      reports,
      error: flush.skippedReason,
    });

    return { runId, durationMs: Date.now() - startedAt, flush, reports };
  } catch (e) {
    const error = e instanceof Error ? e.message : "noma'lum xato";
    await finishRun(db, runId, { flushed: 0, flushFailed: 0, reports: [], error });
    throw e;
  }
}
