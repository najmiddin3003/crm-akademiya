// YANGI / ESKI VERSIYA ALMASHTIRGICHI (17.10.2026).
//
// Loyiha yangi dizayn (v2, design/v2/) bilan bosqichma-bosqich qayta
// quriladi. O'tish davrida ikkala versiya BITTA baza va API ustida yashaydi,
// foydalanuvchi o'zi almashadi — 1–2 oydan keyin hamma yangisiga o'tadi.
//
// Tanlov cookie'da (`tizimli_ui`): manzillar o'zgarmaydi, server birinchi
// chizishdayoq kerakli qobiqni beradi (miltillash yo'q). Cookie'ni o'qish va
// almashtirgich qayerda yoqilgani — lib/uiVersionServer.ts.
//
// Bu fayl brauzerda ham ishlaydi — server-only narsa YO'Q.

export const UI_COOKIE = "tizimli_ui";

export type UiVersion = "v1" | "v2";

/** Noma'lum/bo'sh qiymat — eski versiya (hamma uchun sukut). */
export function normalizeUiVersion(value: unknown): UiVersion {
  return value === "v2" ? "v2" : "v1";
}

/** Bir yil — tanlov «unutilib» qolmasin. */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Brauzerda: tanlovni yozib, sahifani TO'LIQ qayta yuklaydi.
 *
 * `router.refresh()` emas: qobiq almashganda provayderlar (filial,
 * bildirishnoma, topshiriqlar), shrift va sprite'lar ham qaytadan
 * ulanadi — yarim eski, yarim yangi holat qolmasin.
 */
export function switchUiVersion(next: UiVersion): void {
  document.cookie = `${UI_COOKIE}=${next}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
  window.location.reload();
}

/**
 * «Yangi versiya ishlab chiqilmoqda» qatori (components/v2/shell/DevNotice.tsx)
 * yopilganini bildiradi. Cookie — localStorage emas: server ham o'qiydi
 * (lib/uiVersionServer.ts → devNoticeHidden), ya'ni yopilgan qator keyingi
 * yuklanishda bir lahza chiqib-yo'qolmaydi.
 */
export const UI_NOTICE_COOKIE = "tizimli_ui_notice";

/** Qatorni KUN OXIRIGACHA yopadi — cookie yarim tunda (brauzer vaqti) o'zi o'chadi, ertasi kuni qator yana ko'rinadi. */
export function hideDevNoticeForToday(): void {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const seconds = Math.max(60, Math.round((midnight.getTime() - now.getTime()) / 1000));
  document.cookie = `${UI_NOTICE_COOKIE}=1; path=/; max-age=${seconds}; SameSite=Lax`;
}
