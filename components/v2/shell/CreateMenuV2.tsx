"use client";

import { useEffect, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Award, BriefcaseBusiness, ChevronDown, ListChecks, Megaphone, Plus, UserPlus, Users, Wallet } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import { hasSectionPermission, isPathAllowed } from "@/lib/permissions";
import { prefetchCashboxes } from "@/components/v2/finance/cashboxesCache";
import { useCreate, type CreateKind } from "./CreateContext";
import { usePopover } from "./usePopover";

// «+ YANGI» MENYUSI (21-qism · Yuqori panel, 02.11.2026).
//
// Ikki bo'lim: «Ko'p ishlatiladi» (hamma uchun, ruxsatga qarab) va «Rahbar
// uchun» (faqat admin). Bandlar raqamlangan: menyu ochiq turganda 1–8 tugmasi
// bandni tanlaydi, menyu yopiq bo'lsa N uni ochadi (yozish maydonida yoki
// oyna ochiq turganda — yo'q). Klaviatura kirillda bo'lsa ham ishlaydi
// (`code`, `key` emas). Pastda — tugmalar eslatmasi va foydalanuvchi roli.
//
// `kind` — forma SHU JOYDA ochiladi (./CreateContext.tsx); `href` — o'z
// sahifasida (`?add=1` / `?new=1` bilan o'zi ochiladi). `path` — ruxsat
// (lib/permissions.ts); `manage` — bo'lim ruxsatining o'zi kerak (topshiriq
// berish — rahbar rejimi, sahifaga kirish emas).

type IconType = ComponentType<{ className?: string; strokeWidth?: number }>;

interface CreateItem {
  key: string;
  label: string;
  hint: string;
  icon: IconType;
  path: string;
  kind?: CreateKind;
  href?: string;
  manage?: boolean;
}

const COMMON_ITEMS: CreateItem[] = [
  { key: "lead", label: "Lid", hint: "Qo'ng'iroq yoki so'rovnoma", icon: Megaphone, path: "/orders-list", href: "/orders-list?add=1" },
  { key: "student", label: "O'quvchi", hint: "Guruhga qo'shish bilan", icon: UserPlus, path: "/students-list", kind: "student" },
  { key: "payment", label: "To'lov qabul qilish", hint: "O'quvchi to'lovi", icon: Wallet, path: "/finance-cash", kind: "payment" },
  { key: "cash", label: "Kassa amali", hint: "Kirim, chiqim yoki ko'chirish", icon: ArrowLeftRight, path: "/finance-cash", kind: "cash" },
  { key: "task", label: "Topshiriq", hint: "Xodimga vazifa berish", icon: ListChecks, path: "/tasks", href: "/tasks?new=1", manage: true },
];
const ADMIN_ITEMS: CreateItem[] = [
  { key: "group", label: "Guruh", hint: "Kurs, o'qituvchi, xona va vaqt", icon: Users, path: "/groups", href: "/groups?add=1" },
  { key: "staff", label: "Xodim", hint: "Lavozim, ish vaqti va oylik", icon: BriefcaseBusiness, path: "/management-xodimlar", href: "/management-xodimlar?add=1" },
  { key: "bonus", label: "Bonus yoki jarima", hint: "Xodimning oyligiga o'tadi", icon: Award, path: "/finance-bonus", href: "/finance-bonus" },
];

/** Panel (TopbarV2 dagi PANEL bilan bir xil): telefonda ekran kengligida. */
const PANEL =
  "absolute right-0 top-full z-50 mt-2 overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-md max-sm:fixed max-sm:inset-x-3 max-sm:top-[4.25rem] max-sm:mt-0 max-sm:w-auto";
const ROW =
  "flex w-full items-center gap-3 rounded-v2-md px-2 py-1.5 text-left transition-colors hover:bg-v2-hover focus-visible:bg-v2-hover focus-visible:outline-none";
const KBD =
  "inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-v2-sm border border-v2-border bg-v2-surface-2 px-1 font-v2 text-[11px] font-medium leading-none text-v2-text-3 tabular-nums";

/** Yozish maydonida turibdimi yoki biror oyna ochiqmi — unda N/1–8 ishlamaydi. */
function typingOrDialog(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return true;
  return Boolean(document.querySelector('[role="dialog"], [aria-modal="true"]'));
}

export default function CreateMenuV2({ permissions, isAdmin, roleLabel }: { permissions: string[] | null; isAdmin: boolean; roleLabel?: string }) {
  const { t } = useT();
  const router = useRouter();
  const create = useCreate();
  const { open, ref, toggle, close } = usePopover();

  const allowed = (it: CreateItem) => (it.manage ? hasSectionPermission(it.path, permissions) : isPathAllowed(it.path, permissions));
  const common = COMMON_ITEMS.filter(allowed);
  const admin = isAdmin ? ADMIN_ITEMS.filter(allowed) : [];
  const all = [...common, ...admin];

  const activate = (it: CreateItem) => {
    close();
    if (it.kind) create.open(it.kind);
    // `href` bandlari Link — klaviaturadan tanlanganda shu yerdan ochiladi.
    else if (it.href) router.push(it.href);
  };

  // N — menyuni ochish; ochiq turganda 1–8 — bandni tanlash.
  useEffect(() => {
    if (all.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      if (!open) {
        if (e.code === "KeyN" && !e.shiftKey && !typingOrDialog(e.target)) {
          e.preventDefault();
          toggle();
        }
        return;
      }
      const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
      if (!m) return;
      const it = all[Number(m[1]) - 1];
      if (!it) return;
      e.preventDefault();
      activate(it);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (all.length === 0) return null;

  const renderItem = (it: CreateItem, n: number) => {
    const Icon = it.icon;
    const body = (
      <>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-v2-md border border-v2-border bg-v2-surface text-v2-text-2">
          <Icon className="size-4" strokeWidth={1.75} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-v2-body font-semibold text-v2-text">{t(it.label)}</span>
          <span className="block truncate text-v2-caption text-v2-text-3">{t(it.hint)}</span>
        </span>
        <kbd className={KBD} aria-hidden>
          {n}
        </kbd>
      </>
    );
    return it.kind ? (
      <button
        key={it.key}
        type="button"
        role="menuitem"
        onClick={() => activate(it)}
        // Kassalar ro'yxati oldindan — bosilganda oyna kutmasdan ochilsin.
        onPointerEnter={it.kind === "student" ? undefined : prefetchCashboxes}
        aria-keyshortcuts={String(n)}
        className={ROW}
      >
        {body}
      </button>
    ) : (
      <Link key={it.key} href={it.href!} role="menuitem" onClick={close} aria-keyshortcuts={String(n)} className={ROW}>
        {body}
      </Link>
    );
  };

  return (
    <div ref={ref} className="relative hidden sm:block">
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-keyshortcuts="N"
        title={`${t("Yangi")} (N)`}
        className={`inline-flex h-9 items-center gap-1.5 rounded-v2-md border bg-v2-surface px-2.5 text-v2-body font-medium text-v2-text transition-colors hover:bg-v2-surface-2 xl:px-3 ${
          open ? "border-v2-brand shadow-v2-focus" : "border-v2-border-strong"
        }`}
      >
        <Plus className="size-4" strokeWidth={2} aria-hidden />
        <span className="hidden xl:inline">{t("Yangi")}</span>
        <ChevronDown className={`hidden size-4 text-v2-text-3 transition-transform xl:block ${open ? "rotate-180" : ""}`} strokeWidth={1.75} aria-hidden />
      </button>

      {open && (
        <div role="menu" aria-label={t("Yangi")} className={`${PANEL} w-[300px]`}>
          <div className="max-h-[min(70vh,520px)] overflow-y-auto p-1.5">
            {common.length > 0 && (
              <>
                <div className="px-2 pb-1 pt-1.5 text-v2-caption text-v2-text-3">{t("Ko'p ishlatiladi")}</div>
                {common.map((it, i) => renderItem(it, i + 1))}
              </>
            )}
            {admin.length > 0 && (
              <>
                <div className={`px-2 pb-1 pt-2 text-v2-caption text-v2-text-3 ${common.length > 0 ? "mt-1 border-t border-v2-border" : ""}`}>
                  {t("Rahbar uchun")}
                </div>
                {admin.map((it, i) => renderItem(it, common.length + i + 1))}
              </>
            )}
          </div>
          <div className="flex items-center gap-3 border-t border-v2-border bg-v2-surface-2 px-3 py-2 text-v2-caption text-v2-text-3">
            <span className="inline-flex items-center gap-1.5">
              <kbd className={KBD}>N</kbd>
              {t("ochish")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <kbd className={KBD}>{all.length > 1 ? `1–${all.length}` : "1"}</kbd>
              {t("tanlash")}
            </span>
            {roleLabel && (
              <span className="ml-auto truncate" title={t(roleLabel)}>
                {t("Rolingiz: {role}", { role: t(roleLabel) })}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
