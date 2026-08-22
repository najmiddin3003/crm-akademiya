// Topshiriq turlari — Topshiriqlar sahifasidagi "⋮ → Topshiriq turi"
// oynasida boshqariladi va Topshiriq qo'shish/tahrirlash formasidagi
// "Topshiriq turi" tanlovini to'ldiradi. MongoDB `task_types` kolleksiyasi.
//
// Ilgari bu ro'yxat lib/tasksData.ts da qattiq yozilgan 8 ta yozuv edi —
// endi to'liq foydalanuvchi boshqaradi (demo seed yo'q, ro'yxat bo'sh
// holatdan boshlanadi).

export interface TaskType {
  id: number;
  name: string;
  /** HEX rang — TASK_TYPE_COLORS ichidan. */
  color: string;
  /** Ikonka kaliti — TASK_TYPE_ICON_KEYS ichidan (lucide nomlari). */
  icon: string;
}

/** "Yangi tur" oynasidagi rang paletkasi (2 qator × 9). */
export const TASK_TYPE_COLORS = [
  "#3b82f6", "#06b6d4", "#10b981", "#16a34a", "#84cc16", "#eab308", "#f59e0b", "#f97316", "#ef4444",
  "#dc2626", "#ec4899", "#a855f7", "#8b5cf6", "#0ea5e9", "#14b8a6", "#64748b", "#475569", "#1e293b",
];

/** "Yangi tur" oynasidagi belgilar to'plami (4 qator × 8). */
export const TASK_TYPE_ICON_KEYS = [
  "list-checks", "file-plus", "bell", "calendar", "dollar-sign", "user", "user-plus", "user-check",
  "user-x", "user-minus", "users", "graduation-cap", "book-open", "wallet", "credit-card", "clock",
  "bar-chart", "trending-up", "shield", "help-circle", "settings", "zap", "star", "archive",
  "eye", "megaphone", "pencil", "trash", "x-circle", "smile", "frown", "monitor",
];

export const DEFAULT_TASK_TYPE_COLOR = TASK_TYPE_COLORS[0];
export const DEFAULT_TASK_TYPE_ICON = TASK_TYPE_ICON_KEYS[0];

/**
 * Mijozdan kelgan yozuvni xavfsiz ko'rinishga keltiradi: rang va belgi
 * faqat ruxsat etilgan ro'yxatdan bo'lishi mumkin (aks holda oynada
 * ko'rsatib bo'lmaydigan qiymat bazaga tushib qolardi).
 */
export function sanitizeTaskType(body: Partial<TaskType>): { name: string; color: string; icon: string } {
  const name = String(body.name ?? "").trim();
  const color = TASK_TYPE_COLORS.includes(String(body.color)) ? String(body.color) : DEFAULT_TASK_TYPE_COLOR;
  const icon = TASK_TYPE_ICON_KEYS.includes(String(body.icon)) ? String(body.icon) : DEFAULT_TASK_TYPE_ICON;
  return { name, color, icon };
}
