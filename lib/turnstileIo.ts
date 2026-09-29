// Nazorat → Turniket kirish-chiqish analitikasi (sidebar: Nazorat >
// Hisobotlar > Turniket kirish-chiqish analitikasi, href /nazorat-turnstile-io).
// MongoDB `turnstile_io` kolleksiyasi.
//
// "Turniket analitikasi" (lib/turnstile.ts) sahifasidan farqi: u har bir
// kirish/chiqish VOQEASINI alohida qator qilib ko'rsatadi, bu esa har bir
// odam uchun KUNLIK jamlanma beradi — birinchi kirish, oxirgi chiqish va
// shundan kelib chiqadigan holat.
export type TurnstileIoStatus = "kelgan" | "kechikkan" | "kelmagan";

/**
 * «Ishga keldim» (QR) skanerlangan joy (29.09.2026, lib/attendanceCheck.ts).
 * `text` — bazadagi inson o'qiydigan satr (manzil · filialgacha masofa).
 */
export interface TurnstileLocation {
  lat: number;
  lng: number;
  /** Qurilma aytgan aniqlik radiusi, m. */
  acc: number | null;
  /** Filialgacha, m — filial joylashuvi kiritilmagan bo'lsa null. */
  distanceM: number | null;
  /** Yandex manzili (kalit yo'q yoki topilmasa null). */
  address: string | null;
  text: string;
  /** Skanerlangan paytdagi filial nuqtasi — xaritada ikkalasi ko'rinsin. */
  branch: { lat: number; lng: number } | null;
}

export interface TurnstileIoRecord {
  id: number;
  date: string; // "YYYY-MM-DD"
  personName: string;
  personType: "employee" | "student"; // Xodim | O'quvchi
  enterTime: string | null; // "HH:mm" — kelmagan bo'lsa null
  exitTime: string | null;
  status: TurnstileIoStatus;
  /** QR yozuvlarida: kelgan/ketgan paytdagi joylashuv. Turniket importida yo'q. */
  location?: TurnstileLocation | null;
  exitLocation?: TurnstileLocation | null;
}

export const TURNSTILE_IO_PERSON_TYPES: { key: TurnstileIoRecord["personType"]; label: string }[] = [
  { key: "employee", label: "Xodim" },
  { key: "student", label: "O'quvchi" },
];

// Referens saytdagi diagramma yorliqlari/ranglari bilan bir xil tartib.
export const TURNSTILE_IO_STATUSES: { key: TurnstileIoStatus; label: string; color: string }[] = [
  { key: "kelgan", label: "Kelgan", color: "#22c55e" },
  { key: "kechikkan", label: "Kechikkan", color: "#eab308" },
  { key: "kelmagan", label: "Kelmagan", color: "#ef4444" },
];

export const TURNSTILE_IO_STATUS_LABELS: Record<TurnstileIoStatus, string> = {
  kelgan: "Kelgan",
  kechikkan: "Kechikkan",
  kelmagan: "Kelmagan",
};
