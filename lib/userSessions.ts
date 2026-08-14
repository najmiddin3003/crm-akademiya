// "Aktiv qurilmalar" — foydalanuvchining ochiq sessiyalari.
// MongoDB kolleksiyasi: `user_sessions`. Bitta yozuv = bitta qurilmadagi login.
//
// Sessiya cookie'ning o'zi holatsiz (imzolangan HMAC), shuning uchun qurilmani
// uzish uchun alohida ro'yxat kerak: cookie'dagi `sid` shu ro'yxatda bo'lmasa,
// keyingi sahifa ochilishida foydalanuvchi chiqarib yuboriladi.

export interface UserSession {
  sid: string;
  /** users._id ning satr ko'rinishi. */
  userId: string;
  /** Xom User-Agent — tafsilot kerak bo'lsa. */
  userAgent: string;
  /** "Windows · Chrome" ko'rinishidagi o'qiladigan nom. */
  label: string;
  ip: string;
  /** "15.08.2026 | 00:22" */
  createdAt: string;
  lastSeenAt: string;
}

/**
 * User-Agent'dan operatsion tizim va brauzerni ajratadi. To'liq aniqlik shart
 * emas — ro'yxatda qurilmani tanib olish uchun yetarli bo'lsa bo'ldi.
 */
export function describeUserAgent(ua: string): string {
  const s = ua || "";
  let os = "Noma'lum qurilma";
  if (/Windows NT/i.test(s)) os = "Windows";
  else if (/Android/i.test(s)) os = "Android";
  else if (/iPhone|iPad|iPod/i.test(s)) os = "iOS";
  else if (/Mac OS X/i.test(s)) os = "macOS";
  else if (/Linux/i.test(s)) os = "Linux";

  let browser = "";
  // Tartib muhim: Edge/Opera ham "Chrome" satrini o'z ichiga oladi.
  if (/Edg\//i.test(s)) browser = "Edge";
  else if (/OPR\/|Opera/i.test(s)) browser = "Opera";
  else if (/YaBrowser/i.test(s)) browser = "Yandex";
  else if (/Firefox\//i.test(s)) browser = "Firefox";
  else if (/Chrome\//i.test(s)) browser = "Chrome";
  else if (/Safari\//i.test(s)) browser = "Safari";

  return browser ? `${os} · ${browser}` : os;
}
