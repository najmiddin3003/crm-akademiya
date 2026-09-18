import type { Db } from "mongodb";
import type { InlineKeyboard } from "@/lib/telegramApi";
import { editStaffMenu, sendToStaff } from "@/lib/staffBot/api";
import type { StaffBotConfig } from "@/lib/staffBot/config";
import { markBlocked, setMenuMessage } from "@/lib/staffBot/session";

// Ekranni ko'rsatish — oqimlar (kirim, kassam …) va router uchun umumiy.

/** Bo'lim ekrani — matn va tugmalar birga. */
export interface Screen {
  html: string;
  keyboard?: InlineKeyboard;
}

/**
 * Ekranni ko'rsatadi: `messageId` berilsa (tugma bosilgan xabar) o'shani
 * tahrirlashga urinadi, bo'lmasa — yoki tahrirlab bo'lmasa — yangi
 * xabar yuboradi va id'sini eslab qoladi.
 *
 * Matn kelganda (`messageId` yo'q) har doim YANGI xabar: kassir yozgan
 * matn eski menyuning tagida turadi va uni tahrirlash ekranni yuqoriga,
 * ko'zdan yiroqqa olib ketardi.
 */
export async function showScreen(
  db: Db,
  cfg: StaffBotConfig,
  chatId: number,
  messageId: number | undefined,
  screen: Screen,
): Promise<void> {
  if (messageId !== undefined) {
    const edited = await editStaffMenu(cfg, chatId, messageId, screen.html, screen.keyboard);
    if (edited) {
      await setMenuMessage(db, chatId, messageId);
      return;
    }
  }
  const sent = await sendToStaff(cfg, chatId, screen.html, screen.keyboard);
  if (sent.ok) await setMenuMessage(db, chatId, sent.messageId);
  else if (sent.blocked) await markBlocked(db, chatId);
  else console.error("[staff-bot] xabar ketmadi:", sent.error);
}
