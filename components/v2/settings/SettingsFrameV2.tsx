"use client";

import { useMemo, useState, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronDown, Search } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { useShell } from "@/components/v2/shell/ShellContext";
import { isPathAllowed } from "@/lib/permissions";
import { SETTINGS_NAV, navPath, type SettingsNavItem } from "./settingsNav";

// YANGI VERSIYA — «SOZLAMALAR» RAMKASI (rasm «Sozlamalar · Kurslar», yorug'/qorong'i,
// 20.10.2026): chapda ichki menyu (`surface-2`, o'ng chegara) — «Sozlamalar», qidiruv
// «Sozlamani qidirish», bo'limlar (Umumiy, O'quv, Moliya …), faol band oq kartochka
// (yon menyudagi faol band bilan bir xil); o'ngda sahifa (`surface`).
//
// Kompyuterda menyu va sahifa alohida aylantiriladi; telefon/planshetda menyu tepada
// yig'iq tugma («Sozlamalar · Kurslar ⌄») — bosilsa ro'yxat ochiladi.
// Ruxsati yo'q bandlar ko'rinmaydi (yon menyudagi qoida, lib/permissions.ts).

function useActiveCheck() {
  const pathname = usePathname();
  const params = useSearchParams();
  return (href: string) => {
    const [path, query] = href.split("?");
    if (pathname !== path) return false;
    if (!query) return true;
    const want = new URLSearchParams(query);
    return [...want.entries()].every(([k, v]) => params.get(k) === v);
  };
}

export default function SettingsFrameV2({ children, current: currentHref }: { children: ReactNode; /** Faol band (`href`); berilmasa — joriy manzildan. */ current?: string }) {
  const { t } = useT();
  const { permissions, isAdmin } = useShell();
  const byUrl = useActiveCheck();
  const isActive = (href: string) => (currentHref !== undefined ? href === currentHref : byUrl(href));
  const [query, setQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  // Ruxsat bo'yicha kesilgan menyu: band ko'rinadimi — sahifaga kira oladimi (o'chiq
  // bandlar — tizimda yo'q sozlamalar — hammaga ko'rinadi, ular hech qayerga olib bormaydi).
  const allowed = useMemo(
    () =>
      SETTINGS_NAV.map((g) => ({
        ...g,
        items: g.items.filter((it) => (!it.adminOnly || isAdmin) && (!it.href || isPathAllowed(navPath(it.href), permissions))),
      })).filter((g) => g.items.length > 0),
    [permissions, isAdmin],
  );

  const q = query.trim().toLowerCase();
  const groups = useMemo(() => {
    if (!q) return allowed;
    return allowed
      .map((g) => (t(g.title).toLowerCase().includes(q) ? g : { ...g, items: g.items.filter((it) => t(it.label).toLowerCase().includes(q)) }))
      .filter((g) => g.items.length > 0);
  }, [allowed, q, t]);

  const current = allowed.flatMap((g) => g.items).find((it) => it.href && isActive(it.href)) ?? null;

  const item = (it: SettingsNavItem) => {
    const base = "flex h-8 w-full items-center rounded-v2-md border px-2.5 text-left text-v2-body transition-colors";
    if (!it.href) {
      return (
        <li key={it.label}>
          <span aria-disabled title={t(it.note ?? "Hali yo'q")} className={`${base} cursor-not-allowed border-transparent text-v2-text-3`}>
            <span className="min-w-0 flex-1 truncate">{t(it.label)}</span>
          </span>
        </li>
      );
    }
    const active = isActive(it.href);
    return (
      <li key={it.label}>
        <Link
          href={it.href}
          onClick={() => setMobileOpen(false)}
          aria-current={active ? "page" : undefined}
          className={`${base} ${
            active
              ? "border-v2-border bg-v2-surface font-semibold text-v2-text shadow-v2-sm"
              : "border-transparent text-v2-text-2 hover:bg-v2-surface hover:text-v2-text"
          }`}
        >
          <span className="min-w-0 flex-1 truncate">{t(it.label)}</span>
        </Link>
      </li>
    );
  };

  const nav = (
    <>
      <div className="px-3 pb-1">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-v2-text-3" strokeWidth={1.75} aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("Sozlamani qidirish")}
            aria-label={t("Sozlamani qidirish")}
            className="h-8 w-full rounded-v2-md border border-v2-border bg-v2-surface! pl-8 pr-2 text-v2-small text-v2-text placeholder:text-v2-text-3 transition-[border-color,box-shadow] focus:border-v2-brand focus:shadow-v2-focus focus:outline-none"
          />
        </div>
      </div>
      <nav aria-label={t("Sozlamalar")} className="px-3 pb-4">
        {groups.length === 0 && <p className="px-2.5 py-4 text-v2-small text-v2-text-3">{t("Topilmadi")}</p>}
        {groups.map((g) => (
          <div key={g.title} className="mt-3">
            <div className="px-2.5 pb-1 text-v2-caption text-v2-text-3">{t(g.title)}</div>
            <ul className="space-y-0.5">{g.items.map(item)}</ul>
          </div>
        ))}
      </nav>
    </>
  );

  return (
    <div data-ui="v2" className="flex min-h-full flex-col bg-v2-surface font-v2 text-v2-text lg:h-full lg:min-h-0 lg:flex-row">
      {/* Kompyuter: doimiy menyu */}
      <aside className="hidden w-60 shrink-0 border-r border-v2-border bg-v2-surface-2 [scrollbar-width:thin] lg:block lg:overflow-y-auto">
        <h2 className="px-5 pb-3 pt-5 text-[20px] font-semibold leading-7 text-v2-text">{t("Sozlamalar")}</h2>
        {nav}
      </aside>

      {/* Telefon/planshet: yig'iq menyu */}
      <div className="border-b border-v2-border bg-v2-surface-2 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen((o) => !o)}
          aria-expanded={mobileOpen}
          className="flex h-12 w-full items-center gap-2 px-4 text-left"
        >
          <span className="text-v2-section text-v2-text">{t("Sozlamalar")}</span>
          {current && <span className="min-w-0 truncate text-v2-body text-v2-text-2">· {t(current.label)}</span>}
          <ChevronDown className={`ml-auto size-4 shrink-0 text-v2-text-3 transition-transform ${mobileOpen ? "rotate-180" : ""}`} strokeWidth={1.75} aria-hidden />
        </button>
        {mobileOpen && <div className="max-h-[60vh] overflow-y-auto pb-1">{nav}</div>}
      </div>

      <div className="flex min-w-0 flex-1 flex-col lg:min-h-0 lg:overflow-y-auto">{children}</div>
    </div>
  );
}
