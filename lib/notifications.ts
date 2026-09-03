import { NOTIF_STYLES, NOTIF_STYLE_FALLBACK } from "@/constants/notifications";
import { uzDayKey, uzStamp } from "./uzTime";

// Navbardagi qo'ng'iroq panelining TIPLARI va SOF yordamchilari.
//
// Bu fayl `mongodb` ni import QILMAYDI — uni ham route (server), ham panel
// (klient) o'qiydi. Ma'lumotning o'zi constants/notifications.js da.

/** Panel yig'iladigan manbalar. */
export type NotifKind = "payment" | "order" | "task";

/**
 * Manba holati — bo'sh ro'yxat NEGA bo'shligini aytish uchun.
 *   on         — so'raldi, natija shu
 *   off        — bo'lim ruxsati yo'q, manba UMUMAN so'ralmadi
 *   no-cashbox — ruxsat bor, lekin bu filialda xodimga biriktirilgan kassa yo'q
 *
 * Buni ajratmaslik yolg'on bo'lardi: "to'lov yo'q" va "to'lovlarni ko'rish
 * ruxsatingiz yo'q" — butunlay boshqa gap.
 */
export type SourceState = "on" | "off" | "no-cashbox";

export interface NotifStyle {
  bg: string;
  text: string;
  icon: string;
}

export interface NotifItem {
  /** "payment:41" — barqaror React kaliti (indeks EMAS). */
  id: string;
  kind: NotifKind;
  title: string;
  body: string;
  /** Topshiriqda muddat va kechikish; boshqalarda `null`. */
  meta: string | null;
  /** ISO UTC — panelning YAGONA vaqt o'lchovi. */
  at: string;
  href: string;
  unread: boolean;
}

export interface NotifSource {
  state: SourceState;
  unread: number;
  shown: number;
  /** Skanerlash chegarasiga yetildi — sanoq TO'LIQ EMAS. */
  capped: boolean;
}

export interface NotifPayload {
  /** Klient soati siljigan bo'lsa tuzatish uchun. */
  serverNow: string;
  unread: number;
  /** `true` — nishon "N+" ko'rinishida chizilsin. */
  unreadIsFloor: boolean;
  items: NotifItem[];
  sources: Record<NotifKind, NotifSource>;
}

/**
 * Tur bo'yicha uslub. Kalit `string`, `NotifKind` emas — ATAYIN: `kind`
 * tarmoqdan JSON bo'lib keladi va TypeScript uni kafolatlay olmaydi.
 */
export function styleOf(kind: string): NotifStyle {
  return (NOTIF_STYLES as Record<string, NotifStyle>)[kind] ?? NOTIF_STYLE_FALLBACK;
}

/**
 * "850 000" — summa, bo'shliq bilan ajratilgan.
 *
 * YAXLITLASH MAJBURIY: `ru-RU` kasrni VERGUL bilan yozadi ("850 000,5") va
 * keyingi almashtirish uni bo'shliqqa aylantirib "850 000 5" qilardi — bu
 * ekranda 8 500 005 deb o'qiladi. Ajratgich sifatida `ru-RU` uzilmas
 * bo'shliq (U+00A0) qo'yadi, u ham oddiy bo'shliqqa keltiriladi.
 */
export function uzMoney(n: number): string {
  return Math.round(Math.abs(n)).toLocaleString("ru-RU").replace(/[\u00A0,]/g, " ");
}

/** "2 kun kechikdi" — topshiriq muddatidan qancha o'tgani. */
export function overdueUz(minutes: number): string {
  if (minutes < 60) return `${minutes} daqiqa kechikdi`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} soat kechikdi`;
  return `${Math.floor(minutes / 1440)} kun kechikdi`;
}

/**
 * "5 daqiqa oldin" / "Kecha" / "01.09.2026 | 14:30".
 *
 * IKKI XIL O'LCHOV, ATAYIN:
 *   • soatgacha bo'lgan farq — XOM epoch ayirmasi (davomiylik);
 *   • "Kecha" esa TAQVIM kunidan (`uzDayKey`), davomiylikdan emas.
 * Aks holda 47 soatlik farq "Kecha" bo'lib chiqardi, holbuki u avvalgi kun.
 * `toUz` ning siljitilgan `Date` i ayirmaga HECH QACHON tushmaydi — bu
 * lib/uzTime.ts dagi ogohlantirishning aynan o'zi.
 *
 * `nowMs` tashqaridan keladi: u server vaqtiga tekislangan (klient soati
 * uch soat oldinda bo'lsa ham har bir qator "Hozirgina" bo'lib qolmaydi).
 */
export function relativeUz(atIso: string, nowMs: number): string {
  const t = Date.parse(atIso);
  if (!Number.isFinite(t)) return "";
  // Manfiy farq — klient soati orqada. "-3 daqiqa oldin" o'rniga "Hozirgina".
  const d = Math.max(0, nowMs - t);
  if (d < 60_000) return "Hozirgina";
  if (d < 3_600_000) return `${Math.floor(d / 60_000)} daqiqa oldin`;
  const day = uzDayKey(new Date(t));
  if (day === uzDayKey(new Date(nowMs))) return `${Math.floor(d / 3_600_000)} soat oldin`;
  if (day === uzDayKey(new Date(nowMs - 86_400_000))) return "Kecha";
  return uzStamp(new Date(t));
}

/** Nishondagi matn. `unreadIsFloor` — sanoq to'liq emas, "N+" chiziladi. */
export function badgeLabel(unread: number, isFloor: boolean): string {
  if (unread > 99) return "99+";
  return isFloor ? `${unread}+` : String(unread);
}
