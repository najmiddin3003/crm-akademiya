"use client";

import { useMemo, useState } from "react";
import { ArrowRight, CalendarCheck, ChartColumn, Search, Split, Users, Wallet, type LucideIcon } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { EmptyBlock } from "@/components/v2/students/profile/profileBits";
import { REPORTS, REPORT_GROUPS, type ReportGroupKey, type ReportSlug } from "@/lib/reportsCatalog";

// YANGI VERSIYA — «HISOBOTLAR» KATALOGI (rasm «Hisobotlar katalogi», yorug'/qorong'i,
// 25.10.2026): sarlavha «Hisobotlar», izoh «Barcha filiallar · 9 ta hisobot · har biri
// Excel va PDF'ga yuklanadi», o'ngda «Hisobot nomi» qidiruvi. To'rt guruh (rangli
// ikonka + nomi + «3 ta»), har birida kartochkalar: nomi, →, izoh, «Excel» «PDF»
// belgilari. Faqat xodimga ruxsat etilgan hisobotlar ko'rinadi (lib/reportsCatalog.ts).

const GROUP_ICON: Record<ReportGroupKey, { icon: LucideIcon; cls: string }> = {
  finance: { icon: Wallet, cls: "bg-v2-success-bg text-v2-success" },
  flow: { icon: Split, cls: "bg-v2-info-bg text-v2-info" },
  attendance: { icon: CalendarCheck, cls: "bg-v2-warning-bg text-v2-warning" },
  staff: { icon: Users, cls: "bg-v2-violet-bg text-v2-violet" },
};

const tag = "inline-flex h-5 items-center rounded-[5px] border border-v2-border bg-v2-surface-2 px-1.5 text-[11px] font-semibold leading-none text-v2-text-2";

export default function ReportsCatalogV2({ allowed }: { allowed: ReportSlug[] }) {
  const { t } = useT();
  const [q, setQ] = useState("");
  const open = useMemo(() => REPORTS.filter((r) => allowed.includes(r.slug)), [allowed]);
  const needle = q.trim().toLowerCase();
  const shown = open.filter((r) => !needle || `${r.title} ${t(r.title)} ${r.about} ${t(r.about)}`.toLowerCase().includes(needle));

  return (
    <div data-ui="v2" className="flex min-h-full flex-col gap-5 bg-v2-surface p-4 font-v2 text-v2-text sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-v2-page text-v2-text">{t("Hisobotlar")}</h1>
          <p className="mt-0.5 text-v2-small text-v2-text-2">
            {t("Barcha filiallar")} · {t("{n} ta hisobot", { n: open.length })} · {t("har biri Excel va PDF'ga yuklanadi")}
          </p>
        </div>
        {open.length > 0 && (
          <div className="relative w-full sm:w-[260px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-v2-text-3" strokeWidth={1.75} aria-hidden />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("Hisobot nomi")}
              aria-label={t("Hisobot nomi")}
              className="h-9 w-full rounded-v2-md border border-v2-border-field bg-v2-surface! pl-9 pr-3 text-v2-body text-v2-text placeholder:text-v2-text-3 transition-[border-color,box-shadow] focus:border-v2-brand focus:shadow-v2-focus focus:outline-none"
            />
          </div>
        )}
      </div>

      {open.length === 0 ? (
        <div className="py-10">
          <EmptyBlock icon={<ChartColumn className="size-5" strokeWidth={1.75} aria-hidden />} title={t("Sizga ochiq hisobot yo'q")} text={t("Kerakli hisobotni rahbardan so'rang — ruxsat Rollar bo'limida beriladi.")} />
        </div>
      ) : shown.length === 0 ? (
        <div className="py-10">
          <EmptyBlock icon={<Search className="size-5" strokeWidth={1.75} aria-hidden />} title={t("«{q}» bo'yicha hisobot topilmadi", { q: q.trim() })} />
        </div>
      ) : (
        REPORT_GROUPS.map((g) => {
          const list = shown.filter((r) => r.group === g.key);
          if (list.length === 0) return null;
          const gi = GROUP_ICON[g.key];
          const Icon = gi.icon;
          return (
            <section key={g.key} aria-labelledby={`rg-${g.key}`}>
              <h2 id={`rg-${g.key}`} className="mb-2.5 flex items-center gap-2.5">
                <span className={`flex size-7 shrink-0 items-center justify-center rounded-v2-md ${gi.cls}`} aria-hidden>
                  <Icon className="size-4" strokeWidth={1.75} />
                </span>
                <span className="text-v2-body font-semibold text-v2-text">{t(g.label)}</span>
                <span className="text-v2-small text-v2-text-3">{t("{n} ta", { n: list.length })}</span>
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {list.map((r) => (
                  <li key={r.slug}>
                    <Link
                      href={`/reports/${r.slug}`}
                      className="group flex h-full flex-col rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm transition-[border-color,box-shadow] hover:border-v2-border-strong hover:shadow-v2-md focus-visible:outline-none focus-visible:shadow-v2-focus"
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span className="text-v2-body font-semibold text-v2-text">{t(r.title)}</span>
                        <ArrowRight className="mt-0.5 size-4 shrink-0 text-v2-text-3 transition-transform group-hover:translate-x-0.5 group-hover:text-v2-text-2" strokeWidth={1.75} aria-hidden />
                      </span>
                      <span className="mt-1 text-v2-small text-v2-text-2">{t(r.about)}</span>
                      <span className="mt-auto flex gap-1.5 pt-3" aria-label={t("Excel va PDF'ga yuklanadi")}>
                        <span className={tag}>Excel</span>
                        <span className={tag}>PDF</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
