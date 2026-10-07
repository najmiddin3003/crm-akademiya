import type { AiActionKind } from "../protocol";

/**
 * Amalning sahifa ruxsati — web'dagi oyna va xodimlar boti bilan bir xil
 * kalit (lib/staffBot/auth.ts → canLead, canCash). Alohida faylda: vosita
 * ro'yxati (lib/ai/tools) yozuvchi yadrolarni import qilmasin.
 */
export const ACTION_PAGES: Record<AiActionKind, string> = {
  lead: "/orders-list",
  kirim: "/finance-cash",
  chiqim: "/finance-cash",
};
