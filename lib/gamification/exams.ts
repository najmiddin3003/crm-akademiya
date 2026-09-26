import type { Db } from "mongodb";
import { MONTHS } from "@/lib/i18n";
import { SYSTEM } from "./attendance";
import { GAM, gamDb } from "./db";
import { systemReasonMap } from "./reasons";
import { loadSettings } from "./settings";
import type { CoinReason, CoinTransaction, GamSettings, SystemReasonCode } from "./types";
import { systemActor, withWallet } from "./wallet";

// SARHISOB → TANGA (TZ 4.8).
//
// Manba — Imtihon → Sarhisob (`group_exams`). Bizda «oyni yopish» tugmasi
// yo'q: guruh–oy natijasi SAQLANGANI = yopildi (26.09.2026 qarori). Bir
// oyga bir necha marta kiritilsa — eng oxirgisi hisoblanadi.
//   ≥ 90% → examCoins90 · 80–89% → examCoins80 · 70–79% → examCoins70
//   o'sish (joriy − o'tgan oy, foiz punkt) ≥ growthThresholdPp → growthBonusCoins
// Bir o'quvchi–guruh–oy uchun ko'pi bilan bittadan faol `exam_result` va
// `growth` (uniqKey). Natija o'zgarsa — eskisi «Sarhisob natijasi o'zgardi»
// bilan bekor, yangisi yoziladi; M o'zgarsa M+1 ning o'sishi ham qayta.
// Yozuv sanasi — Sarhisob oyining OXIRGI kuni (shu oy reytingiga kiradi).

const AUTO = systemActor("Sarhisob (avto)");

export function lastDayOf(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${month}-${String(d).padStart(2, "0")}`;
}
export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Guruh–oy bo'yicha eng oxirgi natijalar: pupilId → foiz (butun, pastga — TZ 4.8.2). */
async function latestPct(db: Db, groupId: number, month: string): Promise<Map<number, { pct: number; examId: number }>> {
  const exams = await db
    .collection("group_exams")
    .find({ groupId, month }, { projection: { _id: 0, id: 1, students: 1 } })
    .sort({ id: 1 })
    .toArray();
  const out = new Map<number, { pct: number; examId: number }>();
  for (const e of exams) {
    for (const s of (e.students as { pupilId: number; pct: number }[] | undefined) ?? []) {
      const pct = Number(s.pct);
      if (Number.isFinite(pct) && Number.isFinite(Number(s.pupilId))) out.set(Number(s.pupilId), { pct: Math.floor(pct), examId: Number(e.id) });
    }
  }
  return out;
}

function examAmount(pct: number, s: GamSettings): number {
  return pct >= 90 ? s.examCoins90 : pct >= 80 ? s.examCoins80 : pct >= 70 ? s.examCoins70 : 0;
}

interface Want {
  code: SystemReasonCode;
  amount: number;
  note: string;
  pct: number;
  examId: number;
}

/** Bitta o'quvchining bitta turdagi yozuvini moslashtiradi (qulf ostida). */
async function syncOne(
  db: Db,
  pupilId: number,
  groupId: number,
  month: string,
  type: "exam_result" | "growth",
  want: Want | null,
  reason: CoinReason | undefined,
): Promise<boolean> {
  const { result } = await withWallet(db, pupilId, async (w) => {
    if (w.pupil.frozen) return false; // TZ 4.21: Sarhisob hodisasi o'tkaziladi
    const cur = (await db
      .collection(GAM.tx)
      .findOne({ pupilId, groupId, examMonth: month, type, status: "active" }, { projection: { _id: 0 } })) as unknown as CoinTransaction | null;
    const same = cur && want && cur.amount === want.amount && cur.examPercent === want.pct;
    if (same) return true;
    if (cur) await w.cancel(cur, "Sarhisob natijasi o'zgardi", SYSTEM, true);
    if (!want || want.amount <= 0 || !reason?.isActive) return false;
    await w.add({
      groupId,
      date: lastDayOf(month),
      type,
      reasonId: reason.id,
      reasonName: reason.name,
      amount: want.amount,
      note: want.note,
      actor: AUTO,
      uniqKey: `${type === "exam_result" ? "exam" : "growth"}:${groupId}:${pupilId}:${month}`,
      examMonth: month,
      examPercent: want.pct,
      examId: want.examId,
    });
    return true;
  });
  return result;
}

async function syncMonth(
  db: Db,
  settings: GamSettings,
  reasons: Map<SystemReasonCode, CoinReason>,
  groupId: number,
  month: string,
  onlyGrowth: boolean,
): Promise<{ results: number; growth: number }> {
  if (lastDayOf(month) < (settings.startDate ?? "9999")) return { results: 0, growth: 0 };
  const cur = await latestPct(db, groupId, month);
  const prev = await latestPct(db, groupId, shiftMonth(month, -1));
  const mName = MONTHS.uz[Number(month.slice(5, 7)) - 1] ?? month;
  let results = 0;
  let growth = 0;
  for (const [pupilId, r] of cur) {
    try {
      if (!onlyGrowth) {
        const amt = reasons.get("exam_result")?.isActive ? examAmount(r.pct, settings) : 0;
        const ok = await syncOne(
          db, pupilId, groupId, month, "exam_result",
          amt > 0 ? { code: "exam_result", amount: amt, note: `${mName} Sarhisob: ${r.pct}%`, pct: r.pct, examId: r.examId } : null,
          reasons.get("exam_result"),
        );
        if (ok) results++;
      }
      const p = prev.get(pupilId)?.pct ?? null;
      const grew = p !== null && r.pct - p >= settings.growthThresholdPp && reasons.get("growth")?.isActive;
      const ok2 = await syncOne(
        db, pupilId, groupId, month, "growth",
        grew ? { code: "growth", amount: settings.growthBonusCoins, note: `O'sish: ${p}% → ${r.pct}%`, pct: r.pct, examId: r.examId } : null,
        reasons.get("growth"),
      );
      if (ok2) growth++;
    } catch (e) {
      console.error("[gamification] Sarhisob tangasi", { groupId, month, pupilId }, e);
    }
  }
  return { results, growth };
}

/**
 * Sarhisob natijasi saqlangandan KEYIN (app/api/imtihon/group POST).
 * Modul o'chiq yoki oy boshlanishdan oldin bo'lsa — hech narsa qilmaydi.
 */
export async function onExamSaved(db: Db, groupId: number, month: string): Promise<{ results: number; growth: number } | null> {
  const settings = await loadSettings(db);
  if (!settings.enabled || !settings.startDate || !/^\d{4}-\d{2}$/.test(month)) return null;
  await gamDb(); // unique indekslar yozuvdan oldin (db.ts)
  const reasons = await systemReasonMap(db);
  const res = await syncMonth(db, settings, reasons, groupId, month, false);
  // M o'zgardi — M+1 ning o'sishi qayta hisoblanadi (TZ 4.8.4).
  await syncMonth(db, settings, reasons, groupId, shiftMonth(month, 1), true);
  return res;
}

/** Dars jurnalidagi Sarhisob kartasi: shu oy uchun yozilgan natija va o'sish soni. */
export async function examSummary(db: Db, groupId: number, month: string): Promise<{ results: number; growth: number }> {
  const rows = await db
    .collection(GAM.tx)
    .aggregate<{ _id: string; n: number }>([
      { $match: { groupId, examMonth: month, status: "active", type: { $in: ["exam_result", "growth"] } } },
      { $group: { _id: "$type", n: { $sum: 1 } } },
    ])
    .toArray();
  const by = new Map(rows.map((r) => [r._id, r.n]));
  return { results: by.get("exam_result") ?? 0, growth: by.get("growth") ?? 0 };
}
