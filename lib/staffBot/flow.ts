import crypto from "node:crypto";
import type { Db } from "mongodb";
import type { AdjustDeps } from "@/lib/cashboxAdjust";
import type { StaffAccess } from "@/lib/staffBot/auth";
import type { StaffBotConfig } from "@/lib/staffBot/config";
import { showScreen, type Screen } from "@/lib/staffBot/screen";
import type { StaffBotUser } from "@/lib/staffBot/session";

// Oqimlar (Kirim, Chiqim, …) uchun UMUMIY qism: kontekst, ekran
// ko'rsatish, summa o'qish, tasdiq kaliti. Har oqim o'z faylida, lekin
// shu narsalar bir joyda — aks holda summa qoidasi ikki oqimda ikki xil
// bo'lib qolardi.

export interface FlowCtx {
  db: Db;
  cfg: StaffBotConfig;
  chatId: number;
  user: StaffBotUser;
  access: StaffAccess;
  /** Tugma bosilgan xabar — tahrirlash uchun; matn kelganda undefined. */
  messageId?: number;
  defer: AdjustDeps["defer"];
}

export const show = (ctx: FlowCtx, screen: Screen) =>
  showScreen(ctx.db, ctx.cfg, ctx.chatId, ctx.messageId, screen);

/** Tasdiq tugmasining bir martalik kaliti (lib/staffBot/session.ts → nonce). */
export function newNonce(): string {
  return crypto.randomBytes(8).toString("hex");
}

/**
 * Summa matni: "320000", "320 000", "320.000", "320 000 so'm" — hammasi
 * 320000. Boshqa harf bo'lsa null. Yuqori chegara sog'lom fikr uchun:
 * bitta amal 100 mln so'mdan oshmaydi — bu tugmani ushlab qolgan
 * barmoqqa qarshi, hisob qoidasi emas.
 */
export function parseAmount(text: string): number | null {
  const t = text.trim().replace(/\s*so['ʼ’]?m$/i, "");
  if (!/^[\d\s.,'ʼ’]+$/.test(t)) return null;
  const digits = t.replace(/\D/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isSafeInteger(n) && n > 0 && n <= 100_000_000 ? n : null;
}

/** Tugma bosilishiga javob — `handled` va (bo'lsa) qisqa matn. */
export interface CallbackResult {
  handled: boolean;
  toast?: string;
}
