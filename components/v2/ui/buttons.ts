// YANGI VERSIYA: TUGMA KLASSLARI (design/v2/DESIGN.md → «Tugmalar»), ro'yxat
// sahifalari uchun umumiy. Asos klass o'lcham va chekinishsiz — bir xil
// xususiyatli ikki klass (px-3 + w-9 kabi) bir tugmada to'qnashmasin.

/** Ikkinchi darajali tugma asosi (chegara rangi va chekinish variantda). */
export const secondaryBase =
  "inline-flex h-9 shrink-0 items-center gap-2 rounded-v2-md border bg-v2-surface text-v2-body font-medium text-v2-text transition-[background-color,border-color,box-shadow] hover:bg-v2-surface-2 focus-visible:outline-none focus-visible:shadow-v2-focus";
/** «Export» kabi yozuvli ikkinchi darajali tugma. */
export const secondaryBtn = `${secondaryBase} border-v2-border-strong px-3`;
/** «⋯» kabi ikonka tugma. */
export const secondaryIcon = `${secondaryBase} border-v2-border-strong w-9 justify-center`;
/** Sahifaning asosiy amali («+ Guruh qo'shish»). */
export const primaryBtn =
  "inline-flex h-9 shrink-0 items-center gap-2 rounded-v2-md bg-v2-brand px-4 text-v2-body font-semibold text-v2-on-brand transition-[filter] hover:brightness-95 focus-visible:outline-none focus-visible:shadow-v2-focus";

/**
 * Oyna ochadigan tugma («Ustunlar»): ochiq paytida brend chegara + fokus
 * halqasi — rasmdagidek, fon o'zgarmaydi.
 */
export function panelTriggerCls(open: boolean): string {
  return `${secondaryBase} px-3 ${open ? "border-v2-brand shadow-v2-focus hover:bg-v2-surface" : "border-v2-border-strong"}`;
}

/**
 * «Yana filtrlar»: yopiq va bo'sh — UZUQ chegara (Guruhlar rasmi, 18.10.2026);
 * ochiq — brend chegara + halqa (O'quvchilar rasmi); filtr qo'llangan —
 * `brand-bg` + brend chegara + soni.
 */
export function moreFiltersCls(open: boolean, applied: boolean): string {
  const base =
    "inline-flex h-9 shrink-0 items-center gap-2 rounded-v2-md border px-3 text-v2-body font-medium transition-[background-color,border-color,box-shadow] focus-visible:outline-none focus-visible:shadow-v2-focus";
  if (applied) return `${base} border-v2-brand bg-v2-brand-bg text-v2-brand-text ${open ? "shadow-v2-focus" : ""}`;
  if (open) return `${base} border-v2-brand bg-v2-surface text-v2-text shadow-v2-focus`;
  return `${base} border-dashed border-v2-border-strong bg-v2-surface text-v2-text hover:bg-v2-surface-2`;
}
