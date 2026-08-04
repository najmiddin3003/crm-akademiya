// Sotuv va marketing → Xabarlar ro'yhati (sidebar: Sotuv va marketing >
// Xabarlar ro'yhati, href /sales-messages). MongoDB `sms_messages` kolleksiyasi.
//
// Yuborilgan SMS jurnali — sof hisobot (qo'shish/tahrirlash yo'q).
export type SmsKind = "manual" | "auto" | "grouped";

export interface SmsMessage {
  id: number;
  recipientName: string; // To'liq ismi
  text: string; // Xabar
  date: string; // "YYYY-MM-DD" — filtrlash uchun
  time: string; // "HH:mm"
  moderator: string;
  status: string; // "Qabul qilindi" | "Yuborilmadi" | "Kutilmoqda"
  kind: SmsKind;
}

// Yuqoridagi tablar. "Hammasi" — filtrsiz.
export const SMS_TABS: { key: "all" | SmsKind; label: string }[] = [
  { key: "all", label: "Hammasi" },
  { key: "auto", label: "Avto sms" },
  { key: "grouped", label: "Guruhlangan sms" },
];

export const SMS_STATUSES = ["Qabul qilindi", "Kutilmoqda", "Yuborilmadi"];

export function formatSmsDate(m: SmsMessage): string {
  const [y, mo, d] = m.date.split("-");
  return `${d}.${mo}.${y} | ${m.time}`;
}
