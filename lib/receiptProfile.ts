import { CENTER_LOGO, CENTER_SHORT, CENTER_SLOGAN } from "@/lib/center";

// CHEK KO'RINISHI (23-qism «Sozlamalar → Markaz ma'lumotlari → Chek», 13.11.2026).
//
// Bazada `center_profile` {key:"main", receipt:{…}} — faqat rahbar o'zgartiradi
// (app/api/center-profile). Kassa cheki (components/finance/cashReceipt.tsx) shu
// sozlamani o'qiydi: logotip, sarlavha, pastki matn; manzil va telefon — joriy
// filialdan (Sozlamalar → Filiallar).
//
// SUKUT = 23-qismgacha bo'lgan chek: «<Markaz> CRM» sarlavha, shior pastda,
// logotipsiz — sozlama saqlanmaguncha bosma chek o'zgarmaydi (faqat filial manzili
// qo'shiladi). Bu fayl mijoz va server uchun umumiy (mongodb'siz).

export interface ReceiptProfile {
  /** Chek tepasida markaz logotipi (CENTER_LOGO bo'lsagina). */
  showLogo: boolean;
  /** Sarlavha — logotip ostidagi markaz nomi. */
  title: string;
  /** Pastki matn — chek oxiridagi minnatdorchilik/shior. */
  footer: string;
}

export const RECEIPT_TITLE_MAX = 60;
export const RECEIPT_FOOTER_MAX = 120;

export const RECEIPT_DEFAULTS: ReceiptProfile = {
  showLogo: false,
  title: `${CENTER_SHORT} CRM`,
  footer: CENTER_SLOGAN,
};

/** Chekka logotip chiqara olamizmi — markaz sozlamasida logotip bormi. */
export const RECEIPT_HAS_LOGO = !!CENTER_LOGO;

/** Bazadan/so'rovdan kelgan qiymatni tozalaydi; noto'g'ri maydon — sukut. */
export function cleanReceiptProfile(raw: unknown): ReceiptProfile {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const text = (v: unknown, max: number, fallback: string) =>
    typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : fallback;
  return {
    showLogo: typeof r.showLogo === "boolean" ? r.showLogo && RECEIPT_HAS_LOGO : RECEIPT_DEFAULTS.showLogo,
    title: text(r.title, RECEIPT_TITLE_MAX, RECEIPT_DEFAULTS.title),
    footer: text(r.footer, RECEIPT_FOOTER_MAX, RECEIPT_DEFAULTS.footer),
  };
}

/** Chekdagi filial qatori: manzil va telefon (Sozlamalar → Filiallar). */
export interface ReceiptBranch {
  name: string;
  address: string;
  phone: string;
}
