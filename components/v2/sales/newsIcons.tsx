import { BarChart3, BookOpen, Gift, Megaphone, Percent, Sun, Trophy, Users } from "lucide-react";
import type { NewsIcon } from "@/lib/cabinetNewsTypes";

// Yangilik/hikoya belgisi va rangi (36-qism) — Sotuv va marketing → Yangiliklar va o'quvchi kabineti uchun umumiy.
export const NEWS_ICON_VIEW: Record<NewsIcon, { Icon: typeof Trophy; bg: string; tx: string; label: string }> = {
  info: { Icon: Megaphone, bg: "bg-v2-brand-bg", tx: "text-v2-brand", label: "E'lon" },
  trophy: { Icon: Trophy, bg: "bg-v2-warning-bg", tx: "text-v2-warning", label: "Yutuq" },
  gift: { Icon: Gift, bg: "bg-v2-violet-bg", tx: "text-v2-violet", label: "Do'kon" },
  chart: { Icon: BarChart3, bg: "bg-v2-info-bg", tx: "text-v2-info", label: "Sarhisob" },
  sun: { Icon: Sun, bg: "bg-v2-success-bg", tx: "text-v2-success", label: "Ta'til" },
  book: { Icon: BookOpen, bg: "bg-v2-brand-bg", tx: "text-v2-brand", label: "Kurs" },
  percent: { Icon: Percent, bg: "bg-v2-danger-bg", tx: "text-v2-danger", label: "Aksiya" },
  users: { Icon: Users, bg: "bg-v2-surface-2", tx: "text-v2-text-2", label: "Majlis" },
};
