// SOZLAMALAR → O'QUVCHI ILOVASI (38-qism) — kabinet sozlamalari (`app_settings` «student_app»).
export interface StudentAppPrefs {
  /** Kabinetda balans va qarz ko'rinadi (Asosiy → qarz kartasi, To'lovlar → qarz ko'rsatkichi). */
  showDebt: boolean;
  /** Kabinet tepasidagi hikoyalar. */
  stories: boolean;
  /** Kabinet lentasidagi yangiliklar. */
  news: boolean;
  /** 42-qism: kirishda majburiy oferta bo'limlarini «Tanishdim» qilish so'ralsin (Sozlamalar → Ommaviy oferta). */
  ofertaGate: boolean;
}
export const DEFAULT_STUDENT_APP: StudentAppPrefs = { showDebt: true, stories: true, news: true, ofertaGate: false };
