// Nazorat → Turniket kirish-chiqish analitikasi (sidebar: Nazorat >
// Hisobotlar > Turniket kirish-chiqish analitikasi, href /nazorat-turnstile-io).
// MongoDB `turnstile_io` kolleksiyasi.
//
// "Turniket analitikasi" (lib/turnstile.ts) sahifasidan farqi: u har bir
// kirish/chiqish VOQEASINI alohida qator qilib ko'rsatadi, bu esa har bir
// odam uchun KUNLIK jamlanma beradi — birinchi kirish, oxirgi chiqish va
// shundan kelib chiqadigan holat.
export type TurnstileIoStatus = "kelgan" | "kechikkan" | "kelmagan";

export interface TurnstileIoRecord {
  id: number;
  date: string; // "YYYY-MM-DD"
  personName: string;
  personType: "employee" | "student"; // Xodim | O'quvchi
  enterTime: string | null; // "HH:mm" — kelmagan bo'lsa null
  exitTime: string | null;
  status: TurnstileIoStatus;
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
