// YANGI VERSIYA YON MENYUSI ENI (27.11.2026, egasi: «sidebar width uzayganda
// yozuvlar sizelari ham o'zgarsin»).
//
// Kompyuterda menyuning o'ng chekkasidan surib kengaytiriladi/toraytiriladi
// (components/v2/shell/SidebarResizer.tsx). Ichidagi yozuv, ikonka va qatorlar
// ham kattalashadi/kichrayadi — CSS `zoom` bilan (SidebarV2 → `--sb-zoom`), lekin
// en o'zgarishining faqat bir qismi (ZOOM_SHARE): kengaytirilganda ham yozuv
// kattalashadi, ham uzun nomlarga joy ochiladi.
//
// Tanlov cookie'da (har brauzer o'ziniki): server birinchi chizishdayoq to'g'ri
// enni beradi (lib/uiVersionServer.ts → sidebarWidthFromCookie) — sahifa
// yangilanganda menyu sakramaydi. Bu fayl mijoz va server uchun umumiy.

export const SIDEBAR_WIDTH_COOKIE = "tizimli_sbw";
/** Dizayndagi en (avvalgi `w-62`). */
export const SIDEBAR_W_DEFAULT = 248;
export const SIDEBAR_W_MIN = 208;
export const SIDEBAR_W_MAX = 360;
/** En o'zgarishining qancha qismi masshtabga o'tadi: 1 — to'liq mutanosib, 0 — yozuv o'zgarmaydi. */
const ZOOM_SHARE = 0.6;
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function clampSidebarWidth(w: number): number {
  return Math.round(Math.min(SIDEBAR_W_MAX, Math.max(SIDEBAR_W_MIN, w)));
}

/** Cookie qiymatidan en; buzuq yoki yo'q bo'lsa — sukut. */
export function normalizeSidebarWidth(v: string | null | undefined): number {
  const n = Number(v);
  return v && Number.isFinite(n) ? clampSidebarWidth(n) : SIDEBAR_W_DEFAULT;
}

/** Menyu ichidagi masshtab: 248 → 1, 360 → 1.271 (14px yozuv ≈ 17.8px), 208 → 0.903 (≈ 12.6px). */
export function sidebarZoom(w: number): number {
  return Math.round((1 + ((clampSidebarWidth(w) - SIDEBAR_W_DEFAULT) / SIDEBAR_W_DEFAULT) * ZOOM_SHARE) * 1000) / 1000;
}

/** Faqat brauzerda. Sukut eni tanlansa cookie o'chiriladi. */
export function saveSidebarWidth(w: number): void {
  const v = clampSidebarWidth(w);
  document.cookie =
    v === SIDEBAR_W_DEFAULT
      ? `${SIDEBAR_WIDTH_COOKIE}=; path=/; max-age=0; SameSite=Lax`
      : `${SIDEBAR_WIDTH_COOKIE}=${v}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}
