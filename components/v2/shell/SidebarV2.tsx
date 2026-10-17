"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  FileText,
  GraduationCap,
  Lock,
  PanelLeftClose,
  X,
} from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { useBranch, type BranchOption } from "@/components/shared/BranchContext";
import UiVersionSwitch from "@/components/shared/UiVersionSwitch";
import { useSidebarCounts } from "@/hooks/useSidebarCounts";
import {
  isLockedRoute,
  visibleSidebarItems,
  type SidebarItem,
  type SidebarMenu,
  type SidebarMenuItem,
} from "@/components/shared/sidebarModel";
import { branchPool, collapseBranchPools } from "@/lib/branchPools";
import { isPathAllowed } from "@/lib/permissions";
import { BetaBadge } from "./DevNotice";
import { HOME_KEY, V2_BOTTOM_KEYS, V2_ICONS, V2_ITEM_LABELS, V2_LABELS, V2_SECTIONS } from "./sidebarSections";
import { usePopover } from "./usePopover";

// YANGI VERSIYA YON MENYUSI (design/v2/DESIGN.md → «Navigatsiya — yon menyu»).
//
// Eski menyudan farqi: ichki bandlar yon tomonga chiqadigan panelda emas,
// JOYIDA ochiladi (akkordeon); bo'limlar sarlavhalar bilan guruhlangan;
// filial tanlovi yuqori paneldan menyu tepasiga ko'chgan. Bandlar, ruxsatlar
// va havolalar eski menyu bilan BITTA manbadan (components/shared/sidebarModel.ts) —
// kimga nima ko'rinishi ikki versiyada farq qilmaydi.

const HOME_ITEM: SidebarItem = { key: HOME_KEY, icon: "", label: "Bosh sahifa", href: "/home", mobileHref: "/home" };

/** Dizayn qoidasi — interfeysda emoji yo'q (constants/sidebar.js da «🪪 Profil» kabi yozuvlar bor). */
const noEmoji = (s: string) => s.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, "").trim();

const subItemsOf = (menu?: SidebarMenu): SidebarMenuItem[] => menu?.items ?? menu?.columns?.flatMap((c) => c.items) ?? [];

// Band ko'rinishi: faol — oq kartochka (sirt + chiziq), qolgani — Matn 2.
const ROW ="flex h-9 w-full items-center gap-3 rounded-v2-md border px-3 text-v2-body transition-colors";
const ROW_ACTIVE = "border-v2-border bg-v2-surface font-semibold text-v2-text shadow-v2-sm";
const ROW_IDLE = "border-transparent text-v2-text-2 hover:bg-v2-surface/70 hover:text-v2-text";
const COUNT = "shrink-0 text-v2-caption tabular-nums text-v2-text-3";
const ICON = "size-[18px] shrink-0";

export interface SidebarV2Props {
  permissions: string[] | null;
  isAdmin: boolean;
  features: Record<string, boolean>;
  /** Kompyuterda — menyu yonida; telefonda — chekma menyu ichida. */
  variant: "desktop" | "drawer";
  /** Kompyuterda menyuni yig'ish, chekma menyuda — yopish. */
  onClose: () => void;
  /** Havola bosilganda (chekma menyuni yopish uchun). */
  onNavigate?: () => void;
}

export default function SidebarV2({ permissions, isAdmin, features, variant, onClose, onNavigate }: SidebarV2Props) {
  const { t } = useT();
  const pathname = usePathname();
  const counts = useSidebarCounts();
  const gamOn = !!features.gamification;
  const items = useMemo(
    () => visibleSidebarItems(permissions, isAdmin, { gamification: gamOn }),
    [permissions, isAdmin, gamOn],
  );

  // Bandlarni dizayndagi bo'limlarga taqsimlash. Hech qaysi bo'limda yo'q
  // band (keyin qo'shilgani) oxirgi bo'limga tushadi — yo'qolib qolmaydi.
  const { sections, bottom } = useMemo(() => {
    const byKey = new Map(items.map((i) => [i.key, i] as const));
    const used = new Set<string>();
    const pick = (keys: string[]) =>
      keys.flatMap((k) => {
        if (k === HOME_KEY) return [HOME_ITEM];
        const it = byKey.get(k);
        if (!it) return [];
        used.add(k);
        return [it];
      });
    const all = V2_SECTIONS.map((s) => ({ title: s.title, items: pick(s.keys) }));
    const bottomItems = pick(V2_BOTTOM_KEYS);
    const rest = items.filter((i) => !used.has(i.key));
    if (rest.length > 0) all[all.length - 1].items.push(...rest);
    return { sections: all.filter((s) => s.items.length > 0), bottom: bottomItems };
  }, [items]);

  const isActive = (href?: string) => !!href && (pathname === href || pathname.startsWith(`${href}/`));
  const groupActive = (item: SidebarItem) => isActive(item.href) || subItemsOf(item.menu).some((it) => isActive(it.href));

  // Ochiq guruh: sukut bo'yicha joriy sahifa turgan guruh. Foydalanuvchi
  // bosgan tanlov shu sahifada amal qiladi; boshqa sahifaga o'tilganda yana
  // o'sha sahifaning guruhi ochiladi (effektsiz — holatdan hisoblanadi).
  const activeGroup = [...sections.flatMap((s) => s.items), ...bottom].find((i) => i.menu && groupActive(i))?.key ?? null;
  const [toggled, setToggled] = useState<{ path: string; key: string | null } | null>(null);
  const openKey = toggled && toggled.path === pathname ? toggled.key : activeGroup;
  const toggle = (key: string) => setToggled({ path: pathname, key: openKey === key ? null : key });

  const renderSubItem = (it: SidebarMenuItem, key: string) => {
    const locked = isLockedRoute(it.href);
    const active = isActive(it.href);
    const count = it.countKey != null ? counts[it.countKey] : undefined;
    const cls = `flex h-8 items-center gap-2 rounded-v2-md border px-2.5 text-v2-body transition-colors ${active ? ROW_ACTIVE : ROW_IDLE}`;
    const label = noEmoji(t(V2_ITEM_LABELS[it.href] ?? it.label));
    const inner = (
      <>
        {/* Uzun nom («Birinchi darsga yozilganlar») menyu eniga sig'masa — to'liq matni sichqoncha ostida. */}
        <span className="min-w-0 flex-1 truncate" title={label}>{label}</span>
        {/* Son 0 bo'lsa ham ko'rsatiladi (eski menyudagi qoida): 0 — haqiqat, «yuklanmadi» emas. */}
        {locked ? <Lock className="size-3.5 shrink-0 text-v2-text-3" aria-label={t("Qulflangan")} /> : count != null && <span className={COUNT}>{count}</span>}
      </>
    );
    return (
      <li key={key}>
        {locked ? (
          <span title={t("Hali tayyor emas")} className={`${cls} cursor-not-allowed opacity-50`}>{inner}</span>
        ) : (
          <Link href={it.href} onClick={onNavigate} aria-current={active ? "page" : undefined} className={cls}>{inner}</Link>
        )}
      </li>
    );
  };

  const renderSubMenu = (menu: SidebarMenu) => {
    const cols = menu.items ? [{ title: undefined as string | undefined, items: menu.items }] : (menu.columns ?? []);
    return (
      <div className="mb-1 ml-[21px] mt-0.5 border-l border-v2-border pl-2.5">
        {cols.map((c, ci) => (
          <div key={ci}>
            {/* Ko'p ustunli menyularda (Moliya, Nazorat, Hisobotlar) ustun nomi kichik sarlavha bo'ladi. */}
            {c.title && cols.length > 1 && <div className="px-2.5 pb-1 pt-2 text-v2-caption text-v2-text-3">{t(c.title)}</div>}
            <ul className="space-y-0.5">{c.items.map((it, i) => renderSubItem(it, `${ci}-${i}`))}</ul>
          </div>
        ))}
      </div>
    );
  };

  const renderItem = (item: SidebarItem) => {
    const Icon = V2_ICONS[item.key] ?? FileText;
    const label = noEmoji(t(V2_LABELS[item.key] ?? item.label));
    const count = item.badgeKey != null ? counts[item.badgeKey] : undefined;
    const countEl = count != null && count > 0 ? <span className={COUNT}>{count}</span> : null;

    if (item.menu) {
      const open = openKey === item.key;
      const inside = groupActive(item);
      return (
        <li key={item.key}>
          <button
            type="button"
            onClick={() => toggle(item.key)}
            aria-expanded={open}
            className={`${ROW} border-transparent hover:bg-v2-surface/70 hover:text-v2-text ${open ? "font-semibold text-v2-text" : inside ? "text-v2-text" : "text-v2-text-2"}`}
          >
            <Icon className={`${ICON} ${open || inside ? "text-v2-brand" : ""}`} strokeWidth={1.75} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-left">{label}</span>
            {countEl}
            {open ? (
              <ChevronDown className="size-4 shrink-0 text-v2-text-3" aria-hidden />
            ) : (
              <ChevronRight className="size-4 shrink-0 text-v2-text-3" aria-hidden />
            )}
          </button>
          {open && renderSubMenu(item.menu)}
        </li>
      );
    }

    const href = item.href ?? item.mobileHref;
    const active = isActive(href);
    // Bosh sahifa qurilgan sahifalar ro'yxatida yo'q (eski menyuda band emas edi).
    const locked = item.key !== HOME_KEY && isLockedRoute(href);
    const cls = `${ROW} ${active ? ROW_ACTIVE : ROW_IDLE}`;
    const inner = (
      <>
        <Icon className={`${ICON} ${active ? "text-v2-brand" : ""}`} strokeWidth={1.75} aria-hidden />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {locked ? <Lock className="size-3.5 shrink-0 text-v2-text-3" aria-label={t("Qulflangan")} /> : countEl}
      </>
    );
    return (
      <li key={item.key}>
        {locked ? (
          <span title={t("Hali tayyor emas")} className={`${cls} cursor-not-allowed opacity-50`}>{inner}</span>
        ) : (
          <Link href={href} onClick={onNavigate} aria-current={active ? "page" : undefined} className={cls}>{inner}</Link>
        )}
      </li>
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Logotip + menyuni yig'ish (chekma menyuda — yopish) */}
      <div className="flex h-16 shrink-0 items-center gap-2.5 px-4">
        <Link href="/home" onClick={onNavigate} title={t("Bosh sahifa")} className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-v2-md bg-v2-logo text-white">
            <GraduationCap className="size-[18px]" strokeWidth={1.75} aria-hidden />
          </span>
          <span className="truncate text-v2-section text-v2-text">Tizimli</span>
          {/* O'tish davri: versiya hali ishlab chiqilmoqda (./DevNotice.tsx). */}
          <BetaBadge />
        </Link>
        <button
          type="button"
          onClick={onClose}
          title={variant === "drawer" ? t("Yopish") : t("Menyuni yig'ish")}
          aria-label={variant === "drawer" ? t("Yopish") : t("Menyuni yig'ish")}
          className="ml-auto inline-flex size-8 shrink-0 items-center justify-center rounded-v2-md text-v2-text-3 transition-colors hover:bg-v2-surface/70 hover:text-v2-text"
        >
          {variant === "drawer" ? <X className="size-[18px]" strokeWidth={1.75} /> : <PanelLeftClose className="size-[18px]" strokeWidth={1.75} />}
        </button>
      </div>

      <BranchCard permissions={permissions} onNavigate={onNavigate} />

      <nav aria-label={t("Asosiy menyu")} className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 [scrollbar-width:thin]">
        {sections.map((s, si) => (
          <div key={s.title ?? `s${si}`} className={si > 0 ? "mt-4" : "mt-1"}>
            {s.title && <div className="px-3 pb-1 text-v2-caption text-v2-text-3">{t(s.title)}</div>}
            <ul className="space-y-0.5">{s.items.map(renderItem)}</ul>
          </div>
        ))}
      </nav>

      {bottom.length > 0 && (
        <div className="max-h-[50vh] shrink-0 overflow-y-auto border-t border-v2-border px-3 py-2">
          <ul className="space-y-0.5">{bottom.map(renderItem)}</ul>
        </div>
      )}

      {/* O'tish davri: «Eski versiya | Yangi versiya» (lib/uiVersion.ts). Yuqori
          panelda emas — u dizayndagidek to'la, qidiruvga joy qolsin. */}
      <div className="shrink-0 border-t border-v2-border px-3 py-2.5">
        <UiVersionSwitch current="v2" tone="v2" fill />
      </div>
    </div>
  );
}

/**
 * Kvadratdagi filial belgisi: nomidagi raqam («Akademiya 3 Uychi» → 3), raqam
 * bo'lmasa — filial raqami. Hovuzdagi binolar (Chortoq 1+2, lib/branchPools.ts)
 * qaysi bino tanlangan bo'lmasin bitta belgida.
 */
function branchMark(b: BranchOption): string {
  const digits = b.name.match(/\d+/);
  return digits ? digits[0] : String(branchPool(b.id)[0] ?? b.id);
}

/**
 * Filial tanlovi — dizaynda yon menyu tepasidagi kartochka (hozirgi saytda
 * yuqori paneldagi tanlov). Manba o'sha: BranchContext — tanlov cookie'ga
 * yoziladi va sahifa qayta yuklanadi.
 */
function BranchCard({ permissions, onNavigate }: { permissions: string[] | null; onNavigate?: () => void }) {
  const { t } = useT();
  const { branchId, branches, isAdmin, select, loading } = useBranch();
  const { open: popOpen, ref: popWrapRef, toggle: togglePop, close: closePop } = usePopover();
  const list = useMemo(() => collapseBranchPools(branches, branchId), [branches, branchId]);
  const current = list.find((b) => b.id === branchId) ?? null;
  const canManage = isAdmin && isPathAllowed("/management-filiallar", permissions);

  if (loading) {
    return (
      <div className="px-3 pb-2" aria-hidden>
        <div className="h-[52px] rounded-v2-lg bg-v2-skeleton" />
      </div>
    );
  }

  return (
    <div ref={popWrapRef} className="relative px-3 pb-2">
      <button
        type="button"
        onClick={togglePop}
        disabled={list.length === 0 && !canManage}
        aria-haspopup="listbox"
        aria-expanded={popOpen}
        title={t("Filialni tanlash")}
        className="flex w-full items-center gap-3 rounded-v2-lg border border-v2-border bg-v2-surface p-2 text-left shadow-v2-sm transition-colors hover:border-v2-border-strong disabled:cursor-default"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-v2-md bg-v2-brand-bg text-v2-caption font-semibold tabular-nums text-v2-brand-text">
          {current ? branchMark(current) : <Building2 className="size-4" strokeWidth={1.75} aria-hidden />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-v2-body font-semibold text-v2-text">{current ? current.name : t("Filial qo'shilmagan")}</span>
          <span className="block text-v2-caption text-v2-text-3">{t("Joriy filial")}</span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-v2-text-3" strokeWidth={1.75} aria-hidden />
      </button>

      {popOpen && (
        <div className="absolute inset-x-3 top-full z-50 mt-1 max-h-80 overflow-y-auto rounded-v2-lg border border-v2-border bg-v2-surface p-1 shadow-v2-md">
          <div role="listbox" aria-label={t("Filialni tanlash")}>
            {list.map((b) => {
              const on = b.id === branchId;
              return (
                <button
                  key={b.id}
                  type="button"
                  role="option"
                  aria-selected={on}
                  onClick={() => {
                    closePop();
                    if (!on) void select(b.id);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-v2-md px-2 py-1.5 text-left transition-colors hover:bg-v2-hover"
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-v2-sm bg-v2-brand-bg text-[11px] font-semibold tabular-nums text-v2-brand-text">
                    {branchMark(b)}
                  </span>
                  <span className={`min-w-0 flex-1 truncate text-v2-body ${on ? "font-semibold text-v2-text" : "text-v2-text-2"}`}>{b.name}</span>
                  {on && <Check className="size-4 shrink-0 text-v2-brand" strokeWidth={2} aria-hidden />}
                </button>
              );
            })}
          </div>
          {canManage && (
            <>
              {list.length > 0 && <div className="my-1 h-px bg-v2-border" />}
              <Link
                href="/management-filiallar"
                onClick={() => {
                  closePop();
                  onNavigate?.();
                }}
                className="flex items-center gap-2.5 rounded-v2-md px-2 py-1.5 text-v2-body text-v2-brand-text transition-colors hover:bg-v2-hover"
              >
                <Building2 className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />
                {t("Filiallarni boshqarish")}
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
