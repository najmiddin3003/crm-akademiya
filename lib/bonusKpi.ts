import type { Db } from "mongodb";
import type { BranchScope } from "@/lib/branchScope";
import { prevMonth, salesPlan } from "@/lib/salesTargets";
import { uzDateIso } from "@/lib/uzTime";

// SOZLAMALAR → MOLIYA → «BONUS VA KPI» (39-qism, rasm «Sozlamalar · Bonus va KPI»).
//
// Avtomatik bonus qoidalari `app_settings` («bonus_kpi») da saqlanadi. SOTUV BONUSI shu qoidalar bilan Savdo plani
// raqamlaridan (lib/salesTargets.ts → salesPlan: admin nomiga yozilgan yangi o'quvchilar va reja) HISOBLAB
// ko'rsatiladi — Sozlamalar paneli va xodimning «Bonusim» oynasi uchun.
//
// OYLIKKA HALI TUSHMAYDI: Oylik chiqarishdagi «Bonus» ustuni faqat Moliya → Bonus yozuvlaridan (`bonuses`). Hisoblangan
// summani avtomatik qo'shish pulga ta'sir qiladi — egasining qarori kerak (SAVOLLAR 521). Moliya bo'limi bonusi va
// KPI qiymatlari saqlanadi, hisobi hali yo'q (sahifada «Tez orada»).

export interface BonusKpiSettings {
  perStudent: { on: boolean; amount: number };
  plan: { on: boolean; amount: number };
  clawback: { on: boolean };
  debt: { on: boolean; percent: number };
  handover: { on: boolean; amount: number };
  kpi90: number;
  kpi80: number;
}

export const DEFAULT_BONUS_KPI: BonusKpiSettings = {
  perStudent: { on: false, amount: 0 },
  plan: { on: false, amount: 0 },
  clawback: { on: false },
  debt: { on: false, percent: 0 },
  handover: { on: false, amount: 0 },
  kpi90: 0,
  kpi80: 0,
};

const KEY = "bonus_kpi";
const num = (v: unknown, max: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 && n <= max ? n : null;
};

export async function loadBonusKpi(db: Db): Promise<BonusKpiSettings> {
  const d = (await db.collection("app_settings").findOne({ key: KEY })) as Partial<BonusKpiSettings> | null;
  const D = DEFAULT_BONUS_KPI;
  return {
    perStudent: { on: !!d?.perStudent?.on, amount: Number(d?.perStudent?.amount) || D.perStudent.amount },
    plan: { on: !!d?.plan?.on, amount: Number(d?.plan?.amount) || D.plan.amount },
    clawback: { on: !!d?.clawback?.on },
    debt: { on: !!d?.debt?.on, percent: Number(d?.debt?.percent) || D.debt.percent },
    handover: { on: !!d?.handover?.on, amount: Number(d?.handover?.amount) || D.handover.amount },
    kpi90: Number(d?.kpi90) || 0,
    kpi80: Number(d?.kpi80) || 0,
  };
}

const LABEL: Record<string, string> = {
  perStudent: "Har yangi o'quvchi uchun",
  plan: "Oylik savdo plani bajarilsa",
  clawback: "Birinchi oyda ketsa — qaytadi",
  debt: "Qarz undirilsa",
  handover: "Topshiruvda farq bo'lmasa",
  kpi90: "KPI 90% va undan yuqori",
  kpi80: "KPI 80–89%",
};

/** Bitta maydonni o'zgartiradi: `{ field: "plan", on?: boolean, amount?: number }` yoki `{ field: "kpi90", amount }`. */
export async function saveBonusKpi(db: Db, b: { field?: string; on?: unknown; amount?: unknown }, by: string) {
  const f = String(b.field ?? "");
  if (!(f in LABEL)) return { ok: false as const, error: "Noma'lum sozlama" };
  const set: Record<string, unknown> = {};
  const parts: string[] = [];
  if (typeof b.on === "boolean" && f !== "kpi90" && f !== "kpi80") {
    set[`${f}.on`] = b.on;
    parts.push(b.on ? "yoqildi" : "o'chirildi");
  }
  if (b.amount !== undefined) {
    const max = f === "debt" ? 100 : 100_000_000;
    const n = num(b.amount, max);
    if (n === null) return { ok: false as const, error: f === "debt" ? "Foiz 0–100" : "Summa noto'g'ri" };
    set[f === "kpi90" || f === "kpi80" ? f : f === "debt" ? `${f}.percent` : `${f}.amount`] = n;
    parts.push(f === "debt" ? `${n}%` : `${n.toLocaleString("ru-RU")} so'm`);
  }
  if (!parts.length) return { ok: false as const, error: "O'zgarish yo'q" };
  await db.collection("app_settings").updateOne({ key: KEY }, { $set: { key: KEY, ...set } }, { upsert: true });
  await db.collection("feature_log").insertOne({ text: `Bonus: ${LABEL[f]} — ${parts.join(", ")}`, by, at: new Date().toISOString(), scope: "bonus_kpi" });
  return { ok: true as const };
}

export interface SalesBonusRow {
  admin: string;
  branchId: number;
  done: number;
  target: number;
  forecast: number;
  perStudent: number;
  plan: number;
  total: number;
  /** Prognoz bo'yicha rejani bajaradi (hali bajarmagan). */
  willHit: boolean;
}

export function salesBonusOf(s: BonusKpiSettings, r: { admin: string; branchId: number; done: number; target: number; forecast: number }): SalesBonusRow {
  const perStudent = s.perStudent.on ? r.done * s.perStudent.amount : 0;
  const hit = r.target > 0 && r.done >= r.target;
  const plan = s.plan.on && hit ? s.plan.amount : 0;
  return { ...r, perStudent, plan, total: perStudent + plan, willHit: s.plan.on && !hit && r.target > 0 && r.forecast >= r.target };
}

export async function salesBonusMonth(db: Db, scope: BranchScope, branchIds: number[], month: string, s: BonusKpiSettings) {
  const plan = await salesPlan(db, scope, branchIds, month);
  // «Biriktirilmagan» — xodimsiz lidlar yig'indisi (lib/salesTargets.ts), bonus oluvchi emas.
  const rows = plan.rows.filter((r) => r.admin !== "Biriktirilmagan");
  return { month, day: plan.day, days: plan.days, rows: rows.map((r) => salesBonusOf(s, r)).sort((a, b) => b.total - a.total || b.done - a.done) };
}

export async function bonusKpiPage(db: Db, scope: BranchScope, branchIds: number[]) {
  const month = uzDateIso().slice(0, 7);
  const [settings, admins, teachers, branches, log] = await Promise.all([
    loadBonusKpi(db),
    db.collection("hr_employees").countDocuments({ turi: "moderator", archived: { $ne: true } }),
    db.collection("hr_employees").countDocuments({ turi: "teacher", archived: { $ne: true } }),
    db.collection("branches").find({ id: { $in: branchIds } }, { projection: { _id: 0, id: 1, name: 1 } }).toArray(),
    db.collection("feature_log").find({ scope: "bonus_kpi" }, { projection: { _id: 0 } }).sort({ at: -1 }).limit(5).toArray(),
  ]);
  const sales = await salesBonusMonth(db, scope, branchIds, month, settings);
  return {
    ok: true as const,
    today: uzDateIso(),
    settings,
    admins,
    teachers,
    branches: Object.fromEntries(branches.map((b) => [Number(b.id), String(b.name)])),
    sales,
    prevMonth: prevMonth(month),
    log: log.map((l) => ({ text: String(l.text), by: String(l.by ?? ""), at: String(l.at) })),
  };
}

/**
 * «BONUSIM» (39-qism, rasm «Bonusim» telefon) — xodimning o'z sotuv bonusi: shu oy (hozircha) va o'tgan oy, Savdo
 * plani ko'rsatkichlari bilan. Ism bo'yicha (Savdo plani ham admin ismi bilan yuradi), katta-kichik harf farqsiz.
 */
export async function myBonus(db: Db, scope: BranchScope, name: string) {
  const month = uzDateIso().slice(0, 7);
  const s = await loadBonusKpi(db);
  const key = name.trim().toLowerCase();
  const [cur, prev] = await Promise.all([salesBonusMonth(db, scope, scope.allowed, month, s), salesBonusMonth(db, scope, scope.allowed, prevMonth(month), s)]);
  const plan = await salesPlan(db, scope, scope.allowed, month);
  const mine = (rows: SalesBonusRow[]) => rows.find((r) => r.admin.trim().toLowerCase() === key) ?? null;
  const row = plan.rows.find((r) => r.admin.trim().toLowerCase() === key) ?? null;
  return {
    ok: true as const,
    name,
    month,
    prevMonth: prevMonth(month),
    enabled: s.perStudent.on || s.plan.on,
    perStudent: s.perStudent.on ? s.perStudent.amount : 0,
    planBonus: s.plan.on ? s.plan.amount : 0,
    current: mine(cur.rows),
    previous: mine(prev.rows),
    kpi: row ? { leads: row.leads, convPct: row.convPct, forecast: row.forecast, target: row.target } : null,
  };
}
