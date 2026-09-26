import { uzDateIso } from "@/lib/uzTime";
import type { GamActor } from "./actor";
import { daysBetween } from "./attendance";
import { AUTO_TX_TYPES, type CoinTransaction, type GamSettings } from "./types";

// YOZUVNI BEKOR QILISH HUQUQI (TZ 3, 4.1.5, 4.11.3) — «Ortga», uy vazifasi
// belgisini almashtirish/olib tashlash va (3-bosqichda) profil stornosi
// shu bitta qoidadan o'tadi:
//   • avtomatik yozuvlar (davomat, seriya, Sarhisob, o'sish) — hech kim;
//     xarid — faqat «Qaytarish» orqali;
//   • direktor — qo'lda yozilgan istalgan yozuv; tanga sarflangan bo'lsa
//     ham (farq kechiriladi);
//   • filial admini — o'z filiali o'quvchilarining qo'lda ayirishlari
//     (✗ va ayiriladigan sabablar) e'tiroz muddati ichida; o'zi yozganlari —
//     shu kuni;
//   • ustoz — o'zi yozganlari, shu kuni.
// Ketgan (muzlatilgan) o'quvchida faqat direktor (TZ 4.21).

export type CancelDenial = { kind: "auto" | "shop" | "rights" | "spent" | "frozen"; message: string };

/**
 * Sovg'ani qaytarish huquqi (TZ 4.15): filial admini — o'z filialida shu
 * kuni berilganini, direktor — istalganini. Qo'llangan (yoki muddati
 * o'tgan) chegirma qaytarilmaydi — faqat hali faol chegirma.
 */
export function canReturnOrder(
  actor: GamActor,
  o: { status: string; discountId: number | null; branchId: number; givenDate: string },
  today = uzDateIso(),
  discountStatus: string | null = null,
): boolean {
  if (o.status !== "given") return false;
  if (o.discountId !== null && discountStatus !== "active") return false;
  if (actor.role === "director") return true;
  return actor.role === "branch_admin" && actor.branchIds.includes(o.branchId) && o.givenDate === today;
}

export function cancelDenial(
  actor: GamActor,
  tx: CoinTransaction,
  ctx: { balance: number; pupilBranchId: number; frozen: boolean; settings: GamSettings },
  today = uzDateIso(),
): CancelDenial | null {
  if (AUTO_TX_TYPES.includes(tx.type)) {
    return { kind: "auto", message: "Avtomatik yozuv qo'lda bekor qilinmaydi — manba o'zgarganda tizim o'zi qayta hisoblaydi" };
  }
  if (tx.type === "shop") return { kind: "shop", message: "Xarid «Qaytarish» orqali qaytariladi" };
  if (actor.role === "director") return null;
  if (ctx.frozen) return { kind: "frozen", message: "Ketgan o'quvchining yozuvini faqat direktor bekor qiladi" };

  const own = tx.createdByUserId === actor.userId && tx.date === today;
  const adminDeduction =
    actor.role === "branch_admin" &&
    actor.branchIds.includes(ctx.pupilBranchId) &&
    tx.amount < 0 &&
    (tx.type === "homework_missed" || tx.type === "reason") &&
    daysBetween(tx.date, today) <= ctx.settings.objectionDays;
  if (!own && !adminDeduction) {
    const by = tx.createdByName;
    return { kind: "rights", message: `Bu yozuvni ${by} qo'ygan — uni o'zi (shu kuni) yoki direktor bekor qiladi` };
  }
  if (tx.applied > 0 && ctx.balance < tx.applied) {
    return { kind: "spent", message: "O'quvchi bu tangalarni sarflagan — bekor qilish uchun direktorga murojaat qiling" };
  }
  return null;
}
