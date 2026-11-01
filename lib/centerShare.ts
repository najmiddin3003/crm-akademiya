// MARKAZ REYTINGINI ULASHISH — QAYSI QISMLAR KO'RINADI (01.11.2026, foydalanuvchi: «kerakmas
// bo'limni galochka orqali yoqish va o'chirish imkoni ham kerak, ulashilganda galochka qo'yilgan
// qismlar chiqishi kerak holos. Masalan yo'nalish kerak lekin guruh nomi shartmas, ustoz
// shartmas … butun markazga link yaratayotganda shularni hisobga olinishi kerak»).
//
// Tanlov havola kalitining ichida — bitlar to'plami (`mask`), imzo bilan birga
// (lib/groupResultsLink.ts → centerResultsKey): havolani ochgan odam manzilni o'zgartirib
// yashirilgan qismni ocholmaydi. Yashirilgan maydon serverdan brauzerga UMUMAN yuborilmaydi
// (lib/examRanking.ts → publicCenterView). O'rin, o'quvchi ismi va natija (%) doim ko'rinadi,
// telefon — hech qachon. Mijoz (CRM'dagi «Ulashish» oynasi) va server bir xil faylni o'qiydi.
//
// BIT TARTIBI O'ZGARMAYDI — tarqatilgan havolalar shunga bog'liq. Yangi qism faqat OXIRIGA
// qo'shiladi (eski havolalarda u o'chiq bo'lib qoladi).

export const CENTER_SHARE_FIELDS = ["course", "group", "level", "teacher", "correct", "kpis", "podium", "table"] as const;

export type CenterShareField = (typeof CENTER_SHARE_FIELDS)[number];

/** Har qism ko'rinadimi. */
export type CenterShareShow = Record<CenterShareField, boolean>;

/** Birinchi ochilganda (keyin — xodimning oxirgi tanlovi, brauzerda). Ustoz — sukut bo'yicha yashirin. */
export const CENTER_SHARE_DEFAULT: CenterShareShow = {
  course: true,
  group: true,
  level: true,
  teacher: false,
  correct: true,
  kpis: true,
  podium: true,
  table: true,
};

const ALL_BITS = (1 << CENTER_SHARE_FIELDS.length) - 1;

export function encodeShare(show: CenterShareShow): number {
  return CENTER_SHARE_FIELDS.reduce((mask, f, i) => (show[f] ? mask | (1 << i) : mask), 0);
}

export function decodeShare(mask: number): CenterShareShow {
  return Object.fromEntries(CENTER_SHARE_FIELDS.map((f, i) => [f, (mask & (1 << i)) !== 0])) as CenterShareShow;
}

/** Ulashsa bo'ladimi: ma'lum bitlar va uchlik yoki jadvaldan kamida bittasi (aks holda sahifa bo'sh). */
export function isValidShareMask(mask: number): boolean {
  if (!Number.isInteger(mask) || mask < 0 || mask > ALL_BITS) return false;
  const show = decodeShare(mask);
  return show.podium || show.table;
}
