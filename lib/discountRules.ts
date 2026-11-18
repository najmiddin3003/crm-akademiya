import type { Db } from "mongodb";
import { APPROVAL_PERCENT, APPROVAL_SUM } from "@/lib/priceExceptionTypes";

// SOZLAMALAR → MOLIYA → «CHEGIRMALAR» QOIDALARI (39-qism). `app_settings` («discount_rules»).
//
// ULANGAN: «Admin chegarasi» — direktor tasdig'isiz kuchga kiradigan imtiyozning yuqori chegarasi (foiz va summa).
// Chegirma va istisnolar (lib/priceExceptions.ts) shu qiymatni o'qiydi; ilgari 30% / 200 000 qotib turardi.
//
// SAQLANADI, HALI QO'LLANMAYDI: avtomatik chegirmalar (aka-uka, ikki kurs, oldindan to'lov) — qarzga ta'sir
// qiladi, egasining qarori kerak (SAVOLLAR 522). Sahifa ularning hozirgi ta'sirini faqat hisoblab ko'rsatadi.

export interface DiscountRules {
  sibling: { on: boolean; percent: number };
  twoCourses: { on: boolean; percent: number };
  prepay: { on: boolean; percent: number };
  limitPercent: number;
  limitSum: number;
}

const KEY = "discount_rules";

export async function loadDiscountRules(db: Db): Promise<DiscountRules> {
  const d = (await db.collection("app_settings").findOne({ key: KEY })) as Partial<DiscountRules> | null;
  const r = (x: { on?: boolean; percent?: number } | undefined, p: number) => ({ on: !!x?.on, percent: Number(x?.percent) || p });
  return {
    sibling: r(d?.sibling, 15),
    twoCourses: r(d?.twoCourses, 10),
    prepay: r(d?.prepay, 5),
    limitPercent: Number(d?.limitPercent) > 0 ? Number(d?.limitPercent) : APPROVAL_PERCENT,
    limitSum: Number(d?.limitSum) > 0 ? Number(d?.limitSum) : APPROVAL_SUM,
  };
}

export async function approvalLimits(db: Db): Promise<{ percent: number; sum: number }> {
  const r = await loadDiscountRules(db);
  return { percent: r.limitPercent, sum: r.limitSum };
}

const LABEL: Record<string, string> = {
  sibling: "Aka-uka, opa-singil",
  twoCourses: "Ikki va undan ko'p kurs",
  prepay: "Oldindan to'lov",
  limitPercent: "Admin chegarasi (foiz)",
  limitSum: "Admin chegarasi (summa)",
};

export async function saveDiscountRules(db: Db, b: { field?: string; on?: unknown; value?: unknown }, by: string) {
  const f = String(b.field ?? "");
  if (!(f in LABEL)) return { ok: false as const, error: "Noma'lum sozlama" };
  const set: Record<string, unknown> = {};
  const parts: string[] = [];
  const isLimit = f === "limitPercent" || f === "limitSum";
  if (typeof b.on === "boolean" && !isLimit) {
    set[`${f}.on`] = b.on;
    parts.push(b.on ? "yoqildi" : "o'chirildi");
  }
  if (b.value !== undefined) {
    const n = Math.round(Number(b.value));
    const [min, max] = f === "limitSum" ? [10_000, 100_000_000] : [1, 100];
    if (!Number.isFinite(n) || n < min || n > max) return { ok: false as const, error: f === "limitSum" ? "Summa noto'g'ri" : "Foiz 1–100" };
    set[isLimit ? f : `${f}.percent`] = n;
    parts.push(f === "limitSum" ? `${n.toLocaleString("ru-RU")} so'm` : `${n}%`);
  }
  if (!parts.length) return { ok: false as const, error: "O'zgarish yo'q" };
  await db.collection("app_settings").updateOne({ key: KEY }, { $set: { key: KEY, ...set } }, { upsert: true });
  await db.collection("feature_log").insertOne({ text: `Chegirma: ${LABEL[f]} — ${parts.join(", ")}`, by, at: new Date().toISOString(), scope: "discount_rules" });
  return { ok: true as const };
}
