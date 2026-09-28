import { loadSyncConfig } from "@/lib/sync/config";
import { esc, sendMessage } from "@/lib/sync/telegram";
import { ROLE_LABELS } from "@/constants/employees";
import type { AttendanceBranch, AttendanceRecord } from "@/lib/attendanceCheck";

// KECHIKISH → TELEGRAM (28.09.2026, foydalanuvchi qarori: "qayd + adminga
// xabar"). lib/leadNotify.ts naqshi — filialning O'Z topigi:
//
//   TELEGRAM_CHAT_ATTENDANCE  — guruh; bo'lmasa to'lovlar guruhi
//                               (TELEGRAM_CHAT_PAYMENTS).
//   branches.attendanceTopicId — filial topigi (Boshqaruv → Filiallar).
//   TELEGRAM_TOPIC_ATTENDANCE — topigi yo'q filial uchun umumiy topik. U ham
//     bo'lmasa xabar YUBORILMAYDI (jurnalga ogohlantirish) — begona topikka
//     tushib, to'lovlar orasida yo'qolib ketgandan ko'ra.
//   Topiklarni ochish: node scripts/telegram-branch-topics.mjs --attendance --create
//
// Faqat KECHIKKANLAR haqida — vaqtida kelganlar QR ekranidagi ro'yxatda va
// Nazorat → Turniket sahifasida ko'rinadi, guruhni to'ldirib yubormaydi.

/** "2026-09-28" → "28.09.2026". */
function dmy(iso: string): string {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}.${m}.${y}` : iso;
}

export function lateMessage(rec: AttendanceRecord, branchName: string, turi: string): string {
  const role = ROLE_LABELS[turi as keyof typeof ROLE_LABELS] ?? "Xodim";
  const lines = [
    "⏰ <b>Kechikish</b>",
    "",
    `👤 <b>${esc(rec.personName)}</b> · ${esc(role)}`,
  ];
  if (branchName) lines.push(`🏢 ${esc(branchName)}`);
  lines.push(`🕘 Keldi: <b>${esc(rec.enterTime ?? "—")}</b>${rec.expected ? ` · kerak edi: ${esc(rec.expected)}` : ""}`);
  if (rec.expectedWhy) lines.push(`📚 ${esc(rec.expectedWhy)}`);
  lines.push(`⌛ <b>${rec.lateMinutes} daqiqa</b> kechikdi`);
  lines.push(`📅 ${esc(dmy(rec.date))}`);
  return lines.join("\n");
}

/** Topik: filialniki, bo'lmasa umumiy; ikkalasi ham yo'q — bo'sh satr (yuborilmaydi). */
export function attendanceThreadId(branchTopic: number | null | undefined): string {
  return typeof branchTopic === "number" && branchTopic > 0
    ? String(branchTopic)
    : (process.env.TELEGRAM_TOPIC_ATTENDANCE || "").trim();
}

/**
 * Kechikish haqida filial topigiga xabar. HECH QACHON OTILMAYDI — yozuv
 * allaqachon bazada; Telegram ishlamay qolgani xodimning belgilanishiga
 * ta'sir qilmasligi kerak.
 */
export async function notifyLate(rec: AttendanceRecord, branch: AttendanceBranch, turi: string): Promise<void> {
  try {
    if (rec.lateMinutes <= 0) return;
    const cfg = loadSyncConfig();
    const chatId = (process.env.TELEGRAM_CHAT_ATTENDANCE || "").trim() || cfg.targets.payment.chatId;
    if (!cfg.enabled || !cfg.telegramToken || !chatId) return;
    const threadId = attendanceThreadId(branch.attendanceTopicId);
    if (!threadId) {
      console.warn(`[attendance] kechikish xabari yuborilmadi: ${branch.name || `filial ${branch.id}`} uchun davomat topigi yo'q`);
      return;
    }
    await sendMessage(cfg, chatId, lateMessage(rec, branch.name, turi), threadId);
  } catch (e) {
    console.error("[attendance] kechikish xabari yuborilmadi:", e instanceof Error ? e.message : e);
  }
}
