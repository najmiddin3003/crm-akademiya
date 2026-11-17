// NAZORAT → «XABARLAR YETKAZILISHI» (34-qism) — klient va server uchun umumiy.
// Server: lib/messageDelivery.ts; API: app/api/message-delivery. Manba — `sms_messages` jurnali.

/** Bitta xabarning yakuniy holati (kanal + status dan). */
export type DeliveryState = "delivered" | "operator" | "simulated" | "failed" | "pending";

export const DELIVERY_LABELS: Record<DeliveryState, string> = {
  delivered: "Yetkazildi",
  operator: "Operatorga topshirildi",
  simulated: "Sinov — ketmagan",
  failed: "Yetmadi",
  pending: "Kutilmoqda",
};

export const PURPOSE_LABELS: Record<string, string> = {
  payment: "To'lov qabul qilindi",
  reminder: "Qarzdorlik eslatmasi",
  attendance: "Davomat: kelmadi",
  invite: "Xodim taklifi",
  "password-reset": "Parol tiklash",
  manual: "Qo'lda yuborilgan",
  other: "Boshqa",
};

export interface PurposeRow {
  key: string;
  total: number;
  telegram: number;
  sms: number;
  failed: number;
  pending: number;
  channels: ("telegram" | "sms")[];
}

export interface DeliveryRow {
  id: number;
  date: string;
  time: string;
  recipientName: string;
  purpose: string;
  channel: "telegram" | "sms";
  state: DeliveryState;
  text: string;
  error: string;
  moderator: string;
}

export interface DeliveryPayload {
  ok: true;
  from: string;
  to: string;
  kpi: { total: number; purposes: number; telegram: number; sms: number; smsPending: number; failed: number; simulated: number };
  failReasons: { reason: string; purpose: string; n: number }[];
  purposes: PurposeRow[];
  channels: {
    botEnabled: boolean;
    botLinked: number;
    activePupils: number;
    eskiz: boolean;
    paymentSms: boolean;
  };
  rows: DeliveryRow[];
  truncated: boolean;
}
