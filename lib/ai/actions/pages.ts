import type { AiActionKind } from "../protocol";

/**
 * Amalning sahifa ruxsati — web'dagi oyna va xodimlar boti bilan bir xil
 * kalit (lib/staffBot/auth.ts → canLead, canCash; API ruxsatlari —
 * lib/apiPermissions.generated.ts). Alohida faylda: vosita ro'yxati
 * (lib/ai/tools) yozuvchi yadrolarni import qilmasin.
 *
 *   transfer — /api/cashboxes/[id]/transfer-to bilan bir xil (Kassalar);
 *   comment  — /api/pupils/[id]/comments (guruh sahifasidagi «Izoh»);
 *   task     — /tasks hammaga ochiq, topshiriq BERISH esa faqat rahbar va
 *              direktorga — bu qo'shimcha shart vosita (`visible`) va
 *              tasdiqda (lib/ai/actions/execute.ts) tekshiriladi.
 *
 * 5-bosqich (08.10.2026):
 *   pupil      — O'quvchilar ro'yxati (u yerda «O'quvchi qo'shish»; POST
 *                /api/pupils esa hammaga ochiq — AI uchun torroq kalit);
 *   membership — /api/groups/[id]/students ning asosiy sahifasi (Guruhlar);
 *   attendance — /api/groups/[id]/attendance (Guruhlar);
 *   status     — /api/pupils/[id]/status (O'quvchilar ro'yxati);
 *   stage      — /api/orders/[id]/holat (Lidlar).
 */
export const ACTION_PAGES: Record<AiActionKind, string> = {
  lead: "/orders-list",
  kirim: "/finance-cash",
  chiqim: "/finance-cash",
  transfer: "/finance-cash",
  comment: "/groups",
  task: "/tasks",
  pupil: "/students-list",
  membership: "/groups",
  attendance: "/groups",
  status: "/students-list",
  stage: "/orders-list",
};
