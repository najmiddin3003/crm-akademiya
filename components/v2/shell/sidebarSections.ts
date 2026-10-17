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
