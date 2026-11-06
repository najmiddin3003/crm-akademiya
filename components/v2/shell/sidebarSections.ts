import type { LucideIcon } from "lucide-react";
import {
  Award,
  BookOpen,
  ChartColumn,
  Eye,
  FileText,
  GraduationCap,
  House,
  ListChecks,
  Megaphone,
  ScrollText,
  Settings,
  Shield,
  Star,
  TrendingUp,
  Users,
  Wallet,
  Zap,
} from "lucide-react";

// YANGI VERSIYA YON MENYUSINING TUZILISHI (design/v2/DESIGN.md → «Navigatsiya —
// yon menyu»). Bandlarning o'zi, ruxsatlari va havolalari — constants/sidebar.js
// (components/shared/sidebarModel.ts orqali, eski menyu bilan BITTA manba); bu
// yerda faqat ularning yangi menyudagi joyi, ikonkasi va nomi.
//
// Ro'yxatda yo'q kalit (constants/sidebar.js ga keyin qo'shilgan bo'lim)
// yo'qolib qolmaydi — oxirgi bo'limning oxiriga tushadi.

export interface V2Section {
  /** Bo'lim sarlavhasi (dizaynda kichik kulrang yozuv); `null` — sarlavhasiz. */
  title: string | null;
  keys: string[];
}

/** Bosh sahifa constants/sidebar.js da yo'q (eski menyuda logotip bosilardi) — v2 da alohida band. */
export const HOME_KEY = "home";

export const V2_SECTIONS: V2Section[] = [
  { title: null, keys: [HOME_KEY, "tasks"] },
  { title: "O'quv jarayoni", keys: ["leads", "groups", "students", "education", "imtihon", "blok-test", "gamification"] },
  { title: "Moliya va sotuv", keys: ["finance", "sales", "reports"] },
  { title: "Jamoa va nazorat", keys: ["boshqaruv", "nazorat"] },
];

/** Menyuning pastki qismi (dizaynda alohida, chiziq bilan ajratilgan). */
export const V2_BOTTOM_KEYS = ["settings", "action-log", "temp"];

/** Ikonkalar — lucide, chiziq 1.75 (DESIGN.md → Ikonkalar). */
export const V2_ICONS: Record<string, LucideIcon> = {
  [HOME_KEY]: House,
  tasks: ListChecks,
  leads: Megaphone,
  groups: Users,
  students: GraduationCap,
  education: BookOpen,
  imtihon: Award,
  "blok-test": FileText,
  gamification: Star,
  finance: Wallet,
  sales: TrendingUp,
  reports: ChartColumn,
  boshqaruv: Shield,
  nazorat: Eye,
  settings: Settings,
  "action-log": ScrollText,
  temp: Zap,
};

/** Yangi menyuda boshqacha nomlangan bandlar (dizayndagi yozuv). */
export const V2_LABELS: Record<string, string> = {
  temp: "Vaqtinchalik bo'lim",
};

/**
 * Ichki menyu bandlari, manzil bo'yicha — yangi nom (dizayndagi yozuv).
 * «Guruh › Guruhlar» — «Guruhlar · Ustunlar» rasmi, 18.10.2026 (eski menyuda
 * ichki band ham «Guruh» deb turibdi).
 */
export const V2_EXTRA_ITEMS: Record<string, { label: string; href: string }[]> = {
  // Hisobotlar katalogi (15-qism, 25.10.2026) — faqat yangi versiyada: ichki menyuning
  // birinchi bandi. Eski menyu va ruxsatlar daraxti o'zgarmaydi («/reports» doim ochiq,
  // har hisobot sahifa ichida o'z ruxsati bilan — lib/reportsCatalog.ts).
  reports: [{ label: "Barcha hisobotlar", href: "/reports" }],
};

/**
 * Tekis ichki menyuga qo'shiladigan, faqat yangi versiyadagi bandlar: `after` bandidan keyin turadi.
 * Ro'yxat oxirida emas: pastki blok 50vh bilan kesiladi, oxirgi band aylantirmasdan ko'rinmaydi.
 * `adminOnly` — sahifa ruxsatlar daraxtida yo'q, faqat adminga ko'rinadi (to'siq sahifaning o'zida).
 */
const V2_INSERTED_ITEMS: Record<string, { label: string; href: string; after: string; adminOnly?: boolean }[]> = {
  settings: [{ label: "Nazorat qoidalari", href: "/settings-nazorat", after: "/settings-academic", adminOnly: true }],
};

/** `after` bandi ro'yxatda bo'lmasa (nomi o'zgarsa) band yo'qolmaydi — oxiriga tushadi. */
export function withV2Inserted<T extends { label: string; href: string }>(key: string, items: T[], isAdmin: boolean) {
  const out: (T | { label: string; href: string })[] = [...items];
  for (const { label, href, after, adminOnly } of V2_INSERTED_ITEMS[key] ?? []) {
    if (adminOnly && !isAdmin) continue;
    out.splice(out.findIndex((it) => it.href === after) + 1 || out.length, 0, { label, href });
  }
  return out;
}

export const V2_ITEM_LABELS: Record<string, string> = {
  "/groups": "Guruhlar",
  // 7-qism rasmlari (20.10.2026): «Sozlamalar → O'quv → Kurslar», Boshqaruv → «Rollar va huquqlar».
  "/offline-courses": "Kurslar",
  "/management-rollar": "Rollar va huquqlar",
};
