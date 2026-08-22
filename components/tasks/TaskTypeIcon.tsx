"use client";

import {
  Archive, BarChart3, Bell, BookOpen, Calendar, Clock, CreditCard, DollarSign, Eye, FilePlus,
  Frown, GraduationCap, HelpCircle, ListChecks, Megaphone, Monitor, Pencil, Settings, Shield,
  Smile, Star, Trash2, TrendingUp, User, UserCheck, UserMinus, UserPlus, Users, UserX, Wallet,
  XCircle, Zap, type LucideIcon,
} from "lucide-react";
import { DEFAULT_TASK_TYPE_ICON } from "@/lib/taskTypes";

// Topshiriq turi belgilari. Kalitlar lib/taskTypes.ts dagi
// TASK_TYPE_ICON_KEYS bilan bir xil bo'lishi shart — bazada ikonkaning
// KALITI saqlanadi, komponent emas.
//
// Bu yerda sidebar sprite'i (#i-...) emas, lucide ishlatiladi: sprite
// belgilari sahifalar bo'ylab tarqoq e'lon qilingan va hammasi hamma
// sahifada mavjud emas.
const ICONS: Record<string, LucideIcon> = {
  "list-checks": ListChecks,
  "file-plus": FilePlus,
  bell: Bell,
  calendar: Calendar,
  "dollar-sign": DollarSign,
  user: User,
  "user-plus": UserPlus,
  "user-check": UserCheck,
  "user-x": UserX,
  "user-minus": UserMinus,
  users: Users,
  "graduation-cap": GraduationCap,
  "book-open": BookOpen,
  wallet: Wallet,
  "credit-card": CreditCard,
  clock: Clock,
  "bar-chart": BarChart3,
  "trending-up": TrendingUp,
  shield: Shield,
  "help-circle": HelpCircle,
  settings: Settings,
  zap: Zap,
  star: Star,
  archive: Archive,
  eye: Eye,
  megaphone: Megaphone,
  pencil: Pencil,
  trash: Trash2,
  "x-circle": XCircle,
  smile: Smile,
  frown: Frown,
  monitor: Monitor,
};

export default function TaskTypeIcon({ icon, className = "h-4 w-4" }: { icon: string; className?: string }) {
  const Cmp = ICONS[icon] ?? ICONS[DEFAULT_TASK_TYPE_ICON];
  return <Cmp className={className} />;
}
