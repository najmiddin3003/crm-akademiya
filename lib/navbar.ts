import { LANGUAGES, NOTIFICATIONS, NOTIF_STYLES } from "@/constants/navbar";

// `constants/navbar.js` — sof ma'lumot (loyihadagi odat: konstantalar .js da).
// Tiplar shu yerda beriladi, Navbar ham mobil chekma menyu ham shundan oladi.

export interface LanguageInfo {
  flag: string;
  name: string;
  short: string;
}

export interface NotificationItem {
  title: string;
  body: string;
  time: string;
  type: string;
  unread?: boolean;
}

export interface NotifStyle {
  bg: string;
  text: string;
  icon: string;
}

export const LANGS = LANGUAGES as Record<string, LanguageInfo>;
export const NOTIFS = NOTIFICATIONS as NotificationItem[];
export const NOTIF_STYLE = NOTIF_STYLES as Record<string, NotifStyle>;

export const unreadNotifCount = (): number => NOTIFS.filter((n) => n.unread).length;
