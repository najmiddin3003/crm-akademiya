"use client";

import { useRef, useState, type ComponentType, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import Link from "@/components/ui/Link";
import FloatingPanel from "./FloatingPanel";

// YANGI VERSIYA: AMALLAR MENYUSI — «⋯», «Export» va jadval qatoridagi «⋯».
// Tugma ko'rinishi chaqiruvchida (render-prop), menyu bir xil: ikonka + yozuv,
// havola yoki amal, o'chiq band, ajratgich. Klaviatura: ↑↓ bandlar orasida,
// Enter/Space bajaradi, Esc yopadi (FloatingPanel).

type IconType = ComponentType<{ className?: string; strokeWidth?: number }>;

export type ActionMenuEntry =
  | {
      key: string;
      label: string;
      icon?: IconType;
      /** O'ngdagi kichik izoh (masalan «CSV»). */
      hint?: string;
      onSelect?: () => void;
      href?: string;
      disabled?: boolean;
      /** O'chiq bandning sababi — sichqoncha ostida. */
      title?: string;
      danger?: boolean;
    }
  | { key: string; divider: true }
  | { key: string; heading: string };

/** Tugmaga yoyiladigan (DOM uchun xavfsiz) xususiyatlar: `<button {...trigger}>`. */
export interface ActionMenuTriggerProps {
  ref: RefObject<HTMLButtonElement | null>;
  onClick: () => void;
  onKeyDown: (e: KeyboardEvent) => void;
  "aria-haspopup": "menu";
  "aria-expanded": boolean;
}

export default function ActionMenu({
  items,
  align = "end",
  width = 232,
  label,
  children: renderTrigger,
}: {
  items: ActionMenuEntry[];
  align?: "start" | "end";
  width?: number;
  /** Menyuning nomi (ekran o'quvchisi uchun). */
  label: string;
  /** Tugma: `trigger` ni yoying; `open` — ochiq paytdagi ko'rinish uchun. */
  children: (trigger: ActionMenuTriggerProps, open: boolean) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  function focusItem(dir: 1 | -1 | "first") {
    const list = [...(panelRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? [])];
    if (list.length === 0) return;
    const at = list.indexOf(document.activeElement as HTMLElement);
    const next = dir === "first" ? 0 : (at + dir + list.length) % list.length;
    list[next]?.focus();
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    // Ochilganda birinchi bandga fokus — klaviatura bilan darhol yurish uchun.
    if (next) requestAnimationFrame(() => focusItem("first"));
  }

  function onTriggerKey(e: KeyboardEvent) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      toggle();
    }
  }

  function onMenuKey(e: KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); focusItem(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); focusItem(-1); }
    else if (e.key === "Tab") setOpen(false);
  }

  const close = () => setOpen(false);
  const itemCls = (danger?: boolean) =>
    `flex w-full items-center gap-2.5 rounded-v2-md px-2.5 py-2 text-left text-v2-body outline-none transition-colors focus-visible:bg-v2-hover ${
      danger ? "text-v2-danger hover:bg-v2-danger-bg" : "text-v2-text hover:bg-v2-hover"
    }`;

  return (
    <>
      {renderTrigger(
        {
          ref: triggerRef,
          onClick: toggle,
          onKeyDown: onTriggerKey,
          "aria-haspopup": "menu",
          "aria-expanded": open,
        },
        open,
      )}
      <FloatingPanel open={open} anchorRef={triggerRef} onClose={close} align={align} width={width} role="menu" ariaLabel={label}>
        <div ref={panelRef} onKeyDown={onMenuKey} className="overflow-y-auto p-1">
          {items.map((it) => {
            if ("divider" in it) return <div key={it.key} className="my-1 h-px bg-v2-border" role="separator" />;
            if ("heading" in it) {
              return (
                <div key={it.key} className="truncate px-2.5 pb-1 pt-1.5 text-v2-caption text-v2-text-3">
                  {it.heading}
                </div>
              );
            }
            const Icon = it.icon;
            const inner = (
              <>
                {Icon && <Icon className={`size-4 shrink-0 ${it.danger ? "" : "text-v2-text-2"}`} strokeWidth={1.75} />}
                <span className="min-w-0 flex-1 truncate">{it.label}</span>
                {it.hint && <span className="shrink-0 text-v2-caption text-v2-text-3">{it.hint}</span>}
              </>
            );
            if (it.disabled) {
              return (
                <div key={it.key} role="menuitem" aria-disabled="true" title={it.title} className={`${itemCls()} cursor-not-allowed opacity-50 hover:bg-transparent`}>
                  {inner}
                </div>
              );
            }
            if (it.href) {
              return (
                <Link key={it.key} href={it.href} role="menuitem" onClick={close} className={itemCls(it.danger)}>
                  {inner}
                </Link>
              );
            }
            return (
              <button
                key={it.key}
                type="button"
                role="menuitem"
                onClick={() => {
                  close();
                  it.onSelect?.();
                }}
                className={itemCls(it.danger)}
              >
                {inner}
              </button>
            );
          })}
        </div>
      </FloatingPanel>
    </>
  );
}
