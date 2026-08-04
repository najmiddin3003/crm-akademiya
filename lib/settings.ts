// Sozlamalar bo'limi uchun umumiy tiplar.
//
// Saqlash modeli: MongoDB `settings` kolleksiyasida har bir sozlama guruhi
// uchun BITTA hujjat — `{ key: "general.finance", values: {...} }`.
// Shu tarzda yangi karta/tab qo'shilganda migratsiya kerak emas, kalit
// bo'yicha upsert qilinadi.
export interface SettingsDoc {
  key: string;
  values: Record<string, unknown>;
}

// "radio" variantlari "Qiymat|izoh" ko'rinishida yoziladi — izoh ixtiyoriy.
export type SettingsFieldType = "toggle" | "number" | "text" | "time" | "select" | "radio" | "date";

export interface SettingsField {
  key: string;
  label: string;
  type: SettingsFieldType;
  options?: string[];
  default: string | number | boolean;
  // Maydon ichida o'ngda ko'rinadigan birlik — referensdagi "0 UZS" / "0 %".
  suffix?: string;
}

export interface SettingsGroup {
  title?: string;
  fields: SettingsField[];
}

export interface FunctionalityCard {
  key: string;
  title: string;
  description: string;
  color: string;
  icon: string;
  groups: SettingsGroup[];
}

export interface SettingsTab {
  key: string;
  label: string;
}

export interface SettingsSection {
  key: string;
  href: string;
  label: string;
  tabs: SettingsTab[];
}

// Kartaning barcha maydonlaridan boshlang'ich qiymatlar obyektini yasaydi.
export function defaultsOf(card: FunctionalityCard): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const g of card.groups) for (const f of g.fields) out[f.key] = f.default;
  return out;
}
