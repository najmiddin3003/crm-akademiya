"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Boxes, ChartColumn, ChevronRight, GraduationCap, Megaphone, Pin, Search, ShieldCheck, Split, Star, Users, Wallet, type LucideIcon } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { EmptyBlock } from "@/components/v2/students/profile/profileBits";
import { REPORTS, REPORT_GROUPS, REPORT_LINKS, type ReportGroupKey, type ReportSlug } from "@/lib/reportsCatalog";

// YANGI VERSIYA — «HISOBOTLAR» KATALOGI (15-qism; 35-qismda yangilandi — rasm «Hisobotlar», yorug'/qorong'i,
// 17.11.2026). Sarlavha + «N ta hisobot · har biri Excel va PDF'ga yuklanadi», o'ngda qidiruv. «Tez-tez
// ochiladi» — to'rtta ★ karta (Qarzdorlar, Sotuv voronkasi, Kirim va chiqim, Faol o'quvchilar; raqamlar —
// /api/reports/summary). Pastda guruhlar kartalari (ikonka + nomi + «N ta»), ichida qatorlar: nomi, izoh, ›.
// «Nazoratda» — Nazorat bo'limidagi sahifalarga tugmalar. Faqat xodimga ruxsat etilganlar ko'rinadi.

const GROUP_ICON: Record<ReportGroupKey, { icon: LucideIcon; cls: string }> = {
  finance: { icon: Wallet, cls: "bg-v2-success-bg text-v2-success" },
  flow: { icon: Split, cls: "bg-v2-info-bg text-v2-info" },
  staff: { icon: Users, cls: "bg-v2-warning-bg text-v2-warning" },
  sales: { icon: Megaphone, cls: "bg-v2-info-bg text-v2-info" },
  attendance: { icon: GraduationCap, cls: "bg-v2-violet-bg text-v2-violet" },
  resources: { icon: Boxes, cls: "bg-v2-surface-2 text-v2-text-2" },
};

interface Summary {
  ok: true;
  debtors?: { count: number; sum: number; long: number };
  funnel?: { leads: number; paid: number };
  cash?: { net: number; income: number };
  active?: { count: number; joined: number; left: number };
}
const nf = (n: number) => Math.round(n).toLocaleString("ru-RU");

type Item = { key: string; title: string; about: string; href: string; group: string };

export default function ReportsCatalogV2({ allowed, links }: { allowed: ReportSlug[]; links: string[] }) {
  const { t } = useT();
  const [q, setQ] = useState("");
  const [sum, setSum] = useState<Summary | null>(null);
  useEffect(() => {
    void fetch("/api/reports/summary", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => j?.ok && setSum(j))
      .catch(() => {});
  }, []);

  const items: Item[] = useMemo(
    () => [
      ...REPORTS.filter((r) => allowed.includes(r.slug)).map((r) => ({ key: r.slug, title: r.title, about: r.about, href: `/reports/${r.slug}`, group: r.group as string })),
      ...REPORT_LINKS.filter((l) => links.includes(l.key)).map((l) => ({ key: l.key, title: l.title, about: l.about, href: l.href, group: l.group as string })),
    ],
    [allowed, links],
  );
  const needle = q.trim().toLowerCase();
  const shown = items.filter((r) => !needle || `${r.title} ${t(r.title)} ${r.about} ${t(r.about)}`.toLowerCase().includes(needle));
  const reportCount = items.filter((i) => i.group !== "nazorat").length;
  const nazorat = shown.filter((i) => i.group === "nazorat");

  const pins = [
    sum?.debtors && { href: "/reports/qarzdorlar", label: t("Qarzdorlar"), value: nf(sum.debtors.sum), tone: "text-v2-danger", sub: t("{n} qarzdor · {m} tasi 2 oydan ko'p", { n: sum.debtors.count, m: sum.debtors.long }) },
    sum?.funnel && { href: "/reports/sotuv-voronkasi", label: t("Sotuv voronkasi"), value: sum.funnel.leads ? `${Math.round((sum.funnel.paid / sum.funnel.leads) * 100)}%` : "—", tone: "text-v2-text", sub: t("{a} lid → {b} o'quvchi · shu oy", { a: sum.funnel.leads, b: sum.funnel.paid }) },
    sum?.cash && { href: "/reports/kirim-chiqim", label: t("Kirim va chiqim"), value: `${sum.cash.net >= 0 ? "+" : "−"}${nf(Math.abs(sum.cash.net))}`, tone: sum.cash.net >= 0 ? "text-v2-success" : "text-v2-danger", sub: t("shu oy sof · kirim {n}", { n: nf(sum.cash.income) }) },
    sum?.active && { href: "/reports/faol-oquvchilar", label: t("Faol o'quvchilar"), value: nf(sum.active.count), tone: "text-v2-text", sub: t("shu oy +{a} / −{b}", { a: sum.active.joined, b: sum.active.left }) },
  ].filter(Boolean) as { href: string; label: string; value: string; tone: string; sub: string }[];

  return (
    <div data-ui="v2" className="flex min-h-full flex-col gap-4 bg-v2-surface p-4 font-v2 text-v2-text sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-v2-page text-v2-text">{t("Hisobotlar")}</h1>
          <p className="mt-0.5 text-v2-small text-v2-text-2">
            {t("{n} ta hisobot", { n: reportCount })} · {t("har biri Excel va PDF'ga yuklanadi")}
          </p>
        </div>
        {items.length > 0 && (
          <div className="relative w-full sm:w-[280px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-v2-text-3" strokeWidth={1.75} aria-hidden />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("Hisobot nomi yoki ko'rsatkich")}
              aria-label={t("Hisobot nomi")}
              className="h-9 w-full rounded-v2-md border border-v2-border-field bg-v2-surface! pl-9 pr-3 text-v2-body text-v2-text placeholder:text-v2-text-3 transition-[border-color,box-shadow] focus:border-v2-brand focus:shadow-v2-focus focus:outline-none"
            />
          </div>
        )}
      </div>

      {!needle && pins.length > 0 && (
        <section aria-label={t("Tez-tez ochiladi")}>
          <p className="mb-2 flex items-center gap-1.5 text-v2-small text-v2-text-2">
            <Pin className="size-3.5" strokeWidth={1.75} aria-hidden /> {t("Tez-tez ochiladi")}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {pins.map((p) => (
              <Link key={p.href} href={p.href} className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm transition-[border-color,box-shadow] hover:border-v2-border-strong hover:shadow-v2-md">
                <span className="flex items-center justify-between text-v2-small font-semibold text-v2-text">
                  {p.label}
                  <Star className="size-4 fill-v2-warning text-v2-warning" strokeWidth={1.5} aria-hidden />
                </span>
                <span className={`mt-1 block text-[24px] font-semibold leading-8 tabular-nums ${p.tone}`}>{p.value}</span>
                <span className="text-v2-small text-v2-text-2">{p.sub}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {items.length === 0 ? (
        <div className="py-10">
          <EmptyBlock icon={<ChartColumn className="size-5" strokeWidth={1.75} aria-hidden />} title={t("Sizga ochiq hisobot yo'q")} text={t("Kerakli hisobotni rahbardan so'rang — ruxsat Rollar bo'limida beriladi.")} />
        </div>
      ) : shown.length === 0 ? (
        <div className="py-10">
          <EmptyBlock icon={<Search className="size-5" strokeWidth={1.75} aria-hidden />} title={t("«{q}» bo'yicha hisobot topilmadi", { q: q.trim() })} />
        </div>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {REPORT_GROUPS.map((g) => {
            const list = shown.filter((r) => r.group === g.key);
            if (list.length === 0) return null;
            const gi = GROUP_ICON[g.key];
            const Icon = gi.icon;
            return (
              <section key={g.key} aria-labelledby={`rg-${g.key}`} className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
                <h2 id={`rg-${g.key}`} className="flex items-center gap-2.5 border-b border-v2-border px-4 py-3">
                  <span className={`flex size-7 shrink-0 items-center justify-center rounded-v2-md ${gi.cls}`} aria-hidden>
                    <Icon className="size-4" strokeWidth={1.75} />
                  </span>
                  <span className="text-v2-body font-semibold text-v2-text">{t(g.label)}</span>
                  <span className="text-v2-small text-v2-text-3">{t("{n} ta", { n: list.length })}</span>
                </h2>
                <ul className="divide-y divide-v2-border">
                  {list.map((r) => (
                    <li key={r.key}>
                      <Link href={r.href} className="group flex items-center justify-between gap-3 px-4 py-3 hover:bg-v2-hover focus-visible:outline-none focus-visible:shadow-v2-focus">
                        <span className="min-w-0">
                          <span className="block font-semibold text-v2-text">{t(r.title)}</span>
                          <span className="block text-v2-small text-v2-text-2">{t(r.about)}</span>
                        </span>
                        {r.href.startsWith("/reports/") ? (
                          <ChevronRight className="size-4 shrink-0 text-v2-text-3 transition-transform group-hover:translate-x-0.5" strokeWidth={1.75} aria-hidden />
                        ) : (
                          <ArrowRight className="size-4 shrink-0 text-v2-text-3" strokeWidth={1.75} aria-hidden />
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
          {nazorat.length > 0 && (
            <section className="rounded-v2-lg border border-v2-border bg-v2-surface p-4 shadow-v2-sm">
              <h2 className="flex items-center gap-2.5">
                <span className="flex size-7 items-center justify-center rounded-v2-md bg-v2-danger-bg text-v2-danger" aria-hidden>
                  <ShieldCheck className="size-4" strokeWidth={1.75} />
                </span>
                <span>
                  <span className="block font-semibold text-v2-text">{t("Nazoratda")}</span>
                  <span className="block text-v2-small text-v2-text-2">{t("kundalik ish uchun — Nazorat bo'limida ochiladi")}</span>
                </span>
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {nazorat.map((l) => (
                  <Link key={l.key} href={l.href} className="inline-flex h-8 items-center gap-1 rounded-full border border-v2-border px-3 text-v2-small font-semibold text-v2-text hover:bg-v2-hover">
                    {t(l.title)} <ChevronRight className="size-3.5 text-v2-text-3" aria-hidden />
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
