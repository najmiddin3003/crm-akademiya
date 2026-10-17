// YANGI VERSIYA: JADVAL QATORINING FONI (hover, tanlangan, ogohlantirish).
//
// TIRQISH TUZOG'I (18.10.2026, Guruhlar sinovida o'lchandi): Chrome `<tr>`
// fonini HAR KATAKKA alohida chizadi; jadval eni avtomatik bo'linganda
// kataklar eni kasr (189.475 px …) — chegara pikselida ikki katak foni
// yarim-yarim tushib, fon rangidan ochroq/to'qroq 1 px vertikal chiziq
// qoladi (sariq va tanlangan qatorda ko'zga tashlanadi). Katakka 1 px soya
// berish yordam bermadi; qatorning O'ZIGA ichki soya — bitta to'rtburchak,
// tirqishsiz. Oddiy fon ham qoladi: soya chizilmaydigan brauzerda u ko'rinadi.

export const ROW_TINT = {
  hover: "hover:bg-v2-hover hover:shadow-[inset_0_0_0_9999px_var(--v2-hover)]",
  brand: "bg-v2-brand-bg shadow-[inset_0_0_0_9999px_var(--v2-brand-bg)]",
  warning: "bg-v2-warning-bg shadow-[inset_0_0_0_9999px_var(--v2-warning-bg)]",
} as const;

/** Birinchi katakdagi chap 3 px chiziq (tanlangan / ogohlantirish qatori). */
export const ROW_BAR = {
  brand: "shadow-[inset_3px_0_0_var(--v2-brand)]",
  warning: "shadow-[inset_3px_0_0_var(--v2-warning)]",
} as const;
