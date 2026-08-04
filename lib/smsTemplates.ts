// Sotuv va marketing → SMS shablonlari (sidebar: Sotuv va marketing >
// SMS shablonlari, href /sales-sms). MongoDB `sms_templates` kolleksiyasi.
//
// Shablon matnida o'rinbosarlar ishlatiladi (referensdagidek `{name}`) —
// SMS yuborishda haqiqiy qiymatga almashtiriladi.
export interface SmsTemplate {
  id: number;
  title: string; // Sarlavha
  audience: string; // Turi — kimga: "O'quvchi" | "Moderator" | "Ota-ona"
  text: string; // SMS matni
}

export const SMS_AUDIENCES = ["O'quvchi", "Ota-ona", "Moderator", "O'qituvchi"];

// Shablon matnida ruxsat etilgan o'rinbosarlar — qo'shish oynasida
// foydalanuvchiga ko'rsatiladi.
export const SMS_PLACEHOLDERS = ["{name}", "{group}", "{amount}", "{date}"];

export function renderSmsPreview(text: string, values: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (match, key) => values[key] ?? match);
}
