// Interfeys tili — navbardagi til tanlovi bilan boshqariladi.
// Sana tanlagichlar (DatePicker, DateRangePicker, MonthPicker, MonthYearPicker)
// oy va hafta kunlari nomlarini shu yerdan oladi: ilgari ular inglizcha qattiq
// yozilgan edi va navbarda "O'zbekcha" tanlangan bo'lsa ham inglizcha chiqardi.

export type Lang = "uz" | "en" | "ru";

export const LANGS: Lang[] = ["uz", "en", "ru"];

/** To'liq oy nomlari (0 = Yanvar). */
export const MONTHS: Record<Lang, string[]> = {
  uz: ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  ru: ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"],
};

/** Qisqa oy nomlari — MonthPicker/MonthYearPicker katakchalari uchun. */
export const MONTHS_SHORT: Record<Lang, string[]> = {
  uz: ["Yan", "Fev", "Mar", "Apr", "May", "Iyn", "Iyl", "Avg", "Sen", "Okt", "Noy", "Dek"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  ru: ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"],
};

/**
 * Hafta kunlari — YAKSHANBADAN boshlanadi (0 = Yakshanba), chunki taqvim
 * katakchalari `Date.getDay()` bilan tekislanadi.
 */
export const WEEKDAYS_SHORT: Record<Lang, string[]> = {
  uz: ["Yak", "Du", "Se", "Cho", "Pay", "Ju", "Sha"],
  en: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"],
  ru: ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"],
};

/** `toLocaleString` va shunga o'xshash joylar uchun BCP-47 kodi. */
export const LOCALE: Record<Lang, string> = {
  uz: "uz-UZ",
  en: "en-US",
  ru: "ru-RU",
};
