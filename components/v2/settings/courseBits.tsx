"use client";

import { useT } from "@/components/shared/Language";
import { categoryTone, type CategoryTone } from "@/lib/courseCategories";

// YANGI VERSIYA — KURS KATEGORIYASI VA HOLATI BELGILARI (rasm «Sozlamalar · Kurslar»,
// 20.10.2026): kategoriya — och fon + rangli nuqta va yozuv («● Chet tillari» ko'k,
// «● Fanlar» yashil, «● Arab tili» to'q sariq); holat — fonsiz nuqta + matn («● Faol»).

const TONE: Record<CategoryTone, { badge: string; dot: string }> = {
  info: { badge: "bg-v2-info-bg text-v2-info", dot: "bg-v2-info" },
  success: { badge: "bg-v2-success-bg text-v2-success", dot: "bg-v2-success" },
  warning: { badge: "bg-v2-warning-bg text-v2-warning", dot: "bg-v2-warning" },
  violet: { badge: "bg-v2-violet-bg text-v2-violet", dot: "bg-v2-violet" },
  brand: { badge: "bg-v2-brand-bg text-v2-brand-text", dot: "bg-v2-brand" },
};

export function categoryDotCls(name: string): string {
  return TONE[categoryTone(name)].dot;
}

/** «● Chet tillari»; bo'sh — «Kategoriyasiz» (kulrang). */
export function CategoryBadge({ name }: { name?: string }) {
  const { t } = useT();
  const n = (name ?? "").trim();
  if (!n) return <span className="text-v2-small text-v2-text-3">{t("Kategoriyasiz")}</span>;
  const tone = TONE[categoryTone(n)];
  return (
    <span className={`inline-flex h-6 max-w-full items-center gap-1.5 rounded-v2-sm px-2 text-v2-caption font-medium ${tone.badge}`}>
      <span className={`size-1.5 shrink-0 rounded-full ${tone.dot}`} aria-hidden />
      <span className="truncate">{n}</span>
    </span>
  );
}

/** «● Faol» / «● Nofaol». */
export function CourseStatus({ active }: { active: boolean }) {
  const { t } = useT();
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-v2-small ${active ? "text-v2-text-2" : "text-v2-text-3"}`}>
      <span className={`size-1.5 shrink-0 rounded-full ${active ? "bg-v2-success" : "bg-v2-text-3"}`} aria-hidden />
      {active ? t("Faol") : t("Nofaol")}
    </span>
  );
}
