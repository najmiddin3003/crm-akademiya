import type { Db } from "mongodb";
import { eskizConfigured } from "@/lib/eskiz";
import { paymentSmsEnabled } from "@/lib/paymentSms";
import { isStaffBotReady, loadStaffBotConfig } from "@/lib/staffBot/config";
import { isStudentBotReady, loadStudentBotConfig, studentBotPushEnabled } from "@/lib/studentBot/config";
import { loadSyncConfig, syncConfigIssues } from "@/lib/sync/config";
import { outboxCounts } from "@/lib/sync/outbox";
import { latestRuns } from "@/lib/sync/runs";
import { uzDateIso } from "@/lib/uzTime";

// SOZLAMALAR → «INTEGRATSIYALAR» (32-qism, rasm «Integratsiyalar»). Har bir tashqi tizimning HAQIQIY holati:
// faqat «bor / yo'q» va sanoqlar — kalitlar, parollar qaytarilmaydi.
//   • Click / Payme — API ulanmagan; shu oyda «Click / Payme» to'lov turi bilan qo'lda yozilgan kirimlar.
//   • Eski tizim (Google Sheets sinxronizatsiyasi) — lib/sync: sozlama muammolari, navbat, oxirgi tekshiruv.
//   • Telegram botlar (xodim, o'quvchi), SMS · Eskiz — muhit sozlamalari.
//   • Biriktirilmagan to'lovlar — egasi aniqlanmagan kirimlar soni (/api/transaction-entries/unassigned).
// Uzum Bank, bank ko'chirmasi va fiskal chek tizimda yo'q — sahifada «Ulanmagan» (SAVOLLAR).

export interface IntegrationsStatus {
  ok: true;
  month: string;
  online: { count: number; sum: number; last: string | null };
  sync: { enabled: boolean; issues: number; pending: number; failed: number; lastRun: { at: string | null; ok: boolean } | null };
  bots: { staff: boolean; student: boolean; studentPush: boolean };
  sms: { eskiz: boolean; paymentSms: boolean };
  unassigned: number;
}

export async function integrationsStatus(db: Db): Promise<IntegrationsStatus> {
  const today = uzDateIso();
  const month = today.slice(0, 7);
  const entries = db.collection("transaction_entries");
  const [agg] = await entries
    .aggregate([
      { $match: { txType: "payIn", status: { $ne: "cancelled" }, paymentType: { $regex: "click|payme", $options: "i" }, date: { $gte: `${month}-01`, $lte: today } } },
      { $group: { _id: null, n: { $sum: 1 }, s: { $sum: "$amount" }, last: { $max: { $concat: ["$date", " ", "$time"] } } } },
    ])
    .toArray();
  const cfg = loadSyncConfig();
  const issues = syncConfigIssues(cfg);
  const [box, runs, unassigned] = await Promise.all([
    outboxCounts(db).catch(() => null),
    latestRuns(db, 1).catch(() => []),
    entries.countDocuments({ $or: [{ txType: "payIn" }, { txType: "payOut", studentRefund: true }], pupilId: { $exists: false }, studentName: { $nin: ["", null] } }),
  ]);
  const run = runs[0] as { finishedAt?: string | null; startedAt?: string; ok?: boolean } | undefined;
  return {
    ok: true,
    month,
    online: { count: Number(agg?.n ?? 0), sum: Number(agg?.s ?? 0), last: agg?.last ? String(agg.last) : null },
    sync: {
      enabled: cfg.enabled,
      issues: issues.length,
      pending: box?.pending ?? 0,
      failed: box?.failed ?? 0,
      lastRun: run ? { at: run.finishedAt ?? run.startedAt ?? null, ok: !!run.ok } : null,
    },
    bots: { staff: isStaffBotReady(loadStaffBotConfig()), student: isStudentBotReady(loadStudentBotConfig()), studentPush: studentBotPushEnabled() },
    sms: { eskiz: eskizConfigured(), paymentSms: paymentSmsEnabled() },
    unassigned,
  };
}
