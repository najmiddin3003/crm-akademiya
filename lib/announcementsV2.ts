"use client";

import { useSyncExternalStore } from "react";
import { uzDayKey } from "./uzTime";

// YANGI VERSIYA: «E'LONLAR» — Tizimli jamoasining yangiliklari (21-qism:
// Bildirishnomalar → «E'lonlar» varag'i, Yordam menyusidagi «N ta yangi»).
//
// BAZA YO'Q, ATAYIN: e'lon kod bilan birga chiqadi. Reliz qaysi markazga
// (Akademiya, Temuriylar) chiqsa, e'loni ham o'sha yerda paydo bo'ladi —
// hali chiqmagan imkoniyat haqida e'lon ko'rinib qolmaydi.
//
// QOIDALAR:
//   • Yangi e'lon ro'yxat BOSHIGA, `id` — oldingisidan katta. «O'qildi»
//     shu son bilan o'lchanadi (localStorage'da oxirgi ko'rilgan id).
//   • Matn IKKALA markazda to'g'ri bo'lsin (Face ID kabi markazga qarab
//     yoqiladigan narsa — «yoqilgan bo'lsa» deb).
//   • `video` — faqat HAQIQIY qo'llanma bo'lsa. O'ylab topilgan havola yo'q.
//   • `title`, `body`, `label` — qo'shtirnoqli bitta satr (ichida qo'shtirnoq
//     o'rniga «»): i18n skaneri (scripts/i18n-scan.mjs, CONSTANT_SOURCES)
//     ularni shu shaklda o'qiydi. Bu izohda ham o'sha shaklni yozmang —
//     skaner izohni ham kalit deb oladi.
//   • `href` — mavjud sahifa; ruxsati yo'q xodimga havola ko'rsatilmaydi
//     (NotificationsPopoverV2 → isPathAllowed).

export interface AnnouncementLink {
  label: string;
  href: string;
}

export interface Announcement {
  id: number;
  /** Toshkent sanasi, "YYYY-MM-DD". */
  date: string;
  title: string;
  body: string;
  links?: AnnouncementLink[];
  video?: AnnouncementLink;
}

/** Hamma e'lonning yuboruvchisi. */
export const ANNOUNCEMENT_SENDER = "Tizimli jamoasi";

/** Ro'yxat va «yangi» sanog'i shu muddat ichidagilar bo'yicha. */
export const ANNOUNCEMENT_WINDOW_DAYS = 30;

/** Yangisi birinchi. */
export const ANNOUNCEMENTS: readonly Announcement[] = [
  {
    id: 6,
    date: "2026-11-02",
    title: "Imtihon: guruhsiz ro'yxat — butun filial",
    body: "Guruhga hali joylanmagan o'quvchilar natijasini «Guruhsiz» ro'yxatga kiriting: unda filialning barcha faol o'quvchilari, qidiruv va filtr bilan. Bazada yo'q o'quvchini telefonsiz ham qo'shsa bo'ladi.",
    links: [{ label: "Imtihon", href: "/imtihon" }],
  },
  {
    id: 5,
    date: "2026-11-01",
    title: "Sarhisob: markaz reytingi va «Ulashish»",
    body: "Oyning barcha guruhlari bitta reytingda — uchlik, jadval, bosqich, ustoz va guruh filtrlari. «Ulashish» kirishsiz ochiladigan havola beradi; guruh, ustoz kabi qismlarni galochka bilan yoqib-o'chirasiz.",
    links: [{ label: "Markaz reytingi", href: "/imtihon?reyting=1" }],
  },
  {
    id: 4,
    date: "2026-11-01",
    title: "Har guruhga natijalar havolasi",
    body: "Sarhisob qatoridagi ⋯ → «Havolani nusxalash»: guruh natijalari kirishsiz sahifada, jadval ko'rinishida ochiladi. Telefon raqamlar yashiriladi.",
    links: [{ label: "Sarhisob", href: "/imtihon" }],
  },
  {
    id: 3,
    date: "2026-11-01",
    title: "Sarhisobni tahrirlash, arxivlash, o'chirish",
    body: "Sarhisob qatoridagi ⋯ menyusida yangi amallar. Arxivdagi natija ro'yxat va ochiq sahifadan yashiriladi, tanga va botdagi natija o'zgarmaydi.",
    links: [{ label: "Sarhisob", href: "/imtihon" }],
  },
  {
    id: 2,
    date: "2026-11-01",
    title: "Ko'chirmani bekor qilish",
    body: "Pul kelgan kassa egasi yoki admin ko'chirmani sababini yozib bekor qila oladi — qabul qilinganini ham. Pul jo'natgan kassaga qaytadi, jo'natuvchiga sababi bilan oyna chiqadi.",
    links: [{ label: "Kassalar", href: "/finance-cash" }],
  },
  {
    id: 1,
    date: "2026-10-31",
    title: "«Ishga keldim» endi QR kodsiz",
    body: "Xodim kelganini QR kodsiz belgilaydi: filial telefon joylashuvidan aniqlanadi, markazda yoqilgan bo'lsa Face ID ham so'raladi. Joylashuv davomatga yoziladi.",
    links: [{ label: "Ishga keldim", href: "/nazorat-qr" }],
  },
];

/** "2026-11-02" → 20261102 (lib/uzTime.ts `uzDayKey` bilan bir o'lchovda). */
function dayKeyOf(date: string): number {
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? Number(m[1]) * 10000 + Number(m[2]) * 100 + Number(m[3]) : 0;
}

/** Oxirgi {@link ANNOUNCEMENT_WINDOW_DAYS} kundagi e'lonlar (yangisi birinchi). */
export function recentAnnouncements(nowMs: number): Announcement[] {
  const from = uzDayKey(new Date(nowMs - ANNOUNCEMENT_WINDOW_DAYS * 86_400_000));
  return ANNOUNCEMENTS.filter((a) => dayKeyOf(a.date) >= from);
}

// ---------------------------------------------------------------------------
// «O'QILDI» BELGISI — brauzerda (localStorage), har bir qurilmada alohida.
// Saqlab bo'lmasa (maxfiy oyna, taqiq) belgi shu sahifa ochiq turguncha
// xotirada yashaydi — nuqta har bosishda qayta yonib turmasin.

const SEEN_KEY = "tizimli:v2:announcements-seen";
/** Belgi o'zgardi — shu oynadagi hamma o'quvchi komponent yangilanadi. */
const SEEN_EVENT = "v2:announcements-seen";

let memorySeen = 0;

/** Oxirgi ko'rilgan e'lon id'si (hech biri ko'rilmagan — 0). */
export function getSeenAnnouncementId(): number {
  let stored = 0;
  try {
    const n = Number(window.localStorage.getItem(SEEN_KEY) ?? 0);
    if (Number.isFinite(n) && n > 0) stored = n;
  } catch {
    // localStorage yo'q yoki taqiqlangan — xotiradagisi bilan.
  }
  return Math.max(stored, memorySeen);
}

/** Hammasi ko'rildi («E'lonlar» varag'i ochilganda). */
export function markAnnouncementsSeen(): void {
  const newest = ANNOUNCEMENTS.reduce((max, a) => Math.max(max, a.id), 0);
  if (getSeenAnnouncementId() >= newest) return;
  memorySeen = newest;
  try {
    window.localStorage.setItem(SEEN_KEY, String(newest));
  } catch {
    // Saqlanmadi — `memorySeen` sahifa yangilanguncha yetadi.
  }
  window.dispatchEvent(new Event(SEEN_EVENT));
}

function subscribe(onChange: () => void): () => void {
  // `storage` — boshqa varaqda o'qildi (shu varaqning o'zida u kelmaydi).
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === SEEN_KEY) onChange();
  };
  window.addEventListener(SEEN_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(SEEN_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * Ko'rilmagan e'lonlar soni (oxirgi 30 kun) — Yordam menyusidagi «N ta
 * yangi» va «E'lonlar» varag'idagi nuqta. Bir joyda o'qilsa hamma joyda
 * darhol so'nadi. Serverda 0 (localStorage yo'q) — gidratatsiyadan keyin
 * haqiqiy son.
 */
export function useAnnouncementsUnseen(): number {
  return useSyncExternalStore(
    subscribe,
    () => {
      const seen = getSeenAnnouncementId();
      return recentAnnouncements(Date.now()).filter((a) => a.id > seen).length;
    },
    () => 0,
  );
}
