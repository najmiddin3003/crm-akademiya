// VOSITA YORLIQLARI — panelda vosita ishlayotganda chiqadigan matn
// ("Qarzdorlar hisoblanmoqda"). Mijoz ularni `t()` dan o'tkazadi.
//
// NEGA VOSITA TA'RIFIDAN ALOHIDA: lib/ai/tools i18n skaneridan chiqarilgan
// (u yerdagi matnlar modelga yoziladi — scripts/i18n-scan.mjs →
// SERVER_SKIP), bu yorliqlar esa XODIMGA ko'rinadi va tarjima talab
// qiladi. Shu faylda `label:` bo'lib turgani uchun skaner ularni ko'radi.
//
// Yangi vosita qo'shilsa — shu ro'yxatga ham yozing (bo'lmasa umumiy
// "Ma'lumot olinmoqda" chiqadi).

export const TOOL_LABELS: readonly { name: string; label: string }[] = [
  { name: "overview", label: "Asosiy ko'rsatkichlar olinmoqda" },
  { name: "search_pupils", label: "O'quvchilar qidirilmoqda" },
  { name: "pupil_details", label: "O'quvchi ma'lumotlari olinmoqda" },
  { name: "debtors_report", label: "Qarzdorlar hisoblanmoqda" },
  { name: "list_groups", label: "Guruhlar olinmoqda" },
  { name: "leads_summary", label: "Lidlar hisoblanmoqda" },
  { name: "finance_summary", label: "Moliya hisoboti tayyorlanmoqda" },
  { name: "cashbox_balances", label: "Kassa qoldiqlari olinmoqda" },
  { name: "payroll_summary", label: "Oylik hisobi olinmoqda" },
  { name: "crm_help", label: "Qo'llanma ko'rilmoqda" },
  { name: "action_options", label: "Tanlovlar olinmoqda" },
  { name: "propose_lead", label: "Lid qoralamasi tayyorlanmoqda" },
  { name: "propose_kirim", label: "Kirim qoralamasi tayyorlanmoqda" },
  { name: "propose_chiqim", label: "Chiqim qoralamasi tayyorlanmoqda" },
  { name: "*", label: "Ma'lumot olinmoqda" },
];

const BY_NAME = new Map(TOOL_LABELS.map((x) => [x.name, x.label]));

export function toolLabel(name: string): string {
  return BY_NAME.get(name) ?? BY_NAME.get("*")!;
}
