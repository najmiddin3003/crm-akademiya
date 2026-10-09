import type { AiContext } from "../context";
import type { AiActionView } from "../protocol";

// AI VOSITASI — model chaqira oladigan bitta server funksiyasi.
//
// QOIDA: vosita ma'lumotni o'zi tayyorlaydi va model FAQAT shu natijani
// ko'radi. Bazaga to'g'ridan-to'g'ri so'rov yozish, kod bajarish yoki
// boshqa URL'ga borish imkoni modelda YO'Q — u faqat shu ro'yxatdagi
// nomlardan birini argumentlar bilan "so'raydi".
//
// RUXSAT — sahifa ruxsati bilan (lib/permissions.ts): vosita `pages`
// dagi sahifalardan BIRINI ko'ra oladigan xodimga ochiq, ya'ni AI orqali
// xodim CRM'da ko'ra olmaydigan narsani ko'ra olmaydi. Ruxsati yo'q
// vosita modelga UMUMAN ko'rsatilmaydi (lib/ai/tools/index.ts).

export type ToolArgs = Record<string, unknown>;

export interface AiTool {
  /**
   * Model chaqiradigan nom (lotin, snake_case). Panelda chiqadigan yorlig'i
   * lib/ai/toolLabels.ts da (u yerda i18n skaneri uni ko'radi).
   */
  name: string;
  /** Modelga tavsif — qachon va nima uchun chaqirish kerak. */
  description: string;
  /** Argumentlar — JSON Schema. */
  parameters: Record<string, unknown>;
  /**
   * Xodimda shu sahifalardan BIRI bo'lsa vosita ochiq. Bo'sh — hammaga
   * (ichida o'zi kesadi, masalan bosh sahifa kartalari).
   */
  pages: readonly string[];
  /**
   * Amal vositasi (qoralama tuzadi, 2-bosqich) — faqat Sozlamalarda
   * amallar yoqilganda ko'rsatiladi (`ctx.actions`).
   */
  action?: boolean;
  /**
   * Sahifa ruxsatidan TASHQARI qo'shimcha shart (ixtiyoriy). Masalan /tasks
   * sahifasi hammaga ochiq, topshiriq BERISH esa faqat rahbar va direktorga
   * — `pages` buni ifodalay olmaydi. `false` bo'lsa vosita modelga
   * ko'rsatilmaydi va bajarilmaydi (lib/ai/tools/index.ts).
   */
  visible?: (ctx: AiContext) => boolean;
  run: (ctx: AiContext, args: ToolArgs) => Promise<unknown>;
}

/**
 * Amal vositasi qoralama TUZDI: modelga `forModel` ketadi, panelga esa
 * karta (`view`) — lib/ai/chat.ts uni `{type: "action"}` hodisasi qilib
 * yuboradi. Oddiy natijadan `instanceof` bilan ajratiladi. `screen` — yozuv
 * saqlangach ko'rinadigan sahifa (panel ekranda ochadi, 4-bosqich).
 */
export class DraftCreated {
  readonly view: AiActionView;
  readonly forModel: Record<string, unknown>;
  readonly screen: string | undefined;
  /** Shu qoralama bilan ALMASHTIRILGAN (bekor qilingan) eski kartalar — panel ularni o'z joyida yangilaydi. */
  readonly replaced: AiActionView[];
  constructor(view: AiActionView, forModel: Record<string, unknown>, screen?: string, replaced: AiActionView[] = []) {
    this.view = view;
    this.forModel = forModel;
    this.screen = screen;
    this.replaced = replaced;
  }
}

/** Model yuborgan argument yaroqsiz — xato matni modelga qaytadi, u tuzatib qayta so'raydi. */
export class ToolInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolInputError";
  }
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const ISO_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export function optString(a: ToolArgs, key: string, max = 100): string {
  const v = a[key];
  if (v === undefined || v === null) return "";
  if (typeof v !== "string") throw new ToolInputError(`"${key}" must be a string`);
  return v.trim().slice(0, max);
}

export function optInt(a: ToolArgs, key: string, min: number, max: number): number | null {
  const v = a[key];
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new ToolInputError(`"${key}" must be an integer from ${min} to ${max}`);
  }
  return n;
}

/** "YYYY-MM-DD" (haqiqiy kalendar sanasi) yoki bo'sh satr. */
export function optDate(a: ToolArgs, key: string): string {
  const v = optString(a, key, 10);
  if (!v) return "";
  const d = new Date(`${v}T00:00:00Z`);
  if (!ISO_DAY.test(v) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) {
    throw new ToolInputError(`"${key}" must be a date in YYYY-MM-DD format`);
  }
  return v;
}

/** "YYYY-MM" yoki bo'sh satr. */
export function optMonth(a: ToolArgs, key: string): string {
  const v = optString(a, key, 7);
  if (v && !ISO_MONTH.test(v)) throw new ToolInputError(`"${key}" must be a month in YYYY-MM format`);
  return v;
}

/** "YYYY-MM" → oyning birinchi va oxirgi kuni. */
export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

/** Ikki sana orasidagi kunlar (ikkala chekka ham kiradi). */
export function daysInclusive(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}
