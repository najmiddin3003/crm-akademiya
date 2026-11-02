"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Contrast, Globe, Lock, LockKeyhole, LogOut, Moon, RotateCcw, Sun, UserRound } from "lucide-react";
import Link from "@/components/ui/Link";
import { useBranch } from "@/components/shared/BranchContext";
import { useLang, useT } from "@/components/shared/Language";
import { useTheme } from "@/components/shared/Theme";
import { collapseBranchPools } from "@/lib/branchPools";
import { LANGS as LANG_CODES } from "@/lib/i18n";
import { LANGS as LANGUAGES } from "@/lib/navbar";
import { switchUiVersion } from "@/lib/uiVersion";
import type { ShellUserV2 } from "./TopbarV2";
import { usePopover } from "./usePopover";

// PROFIL MENYUSI (21-qism · Yuqori panel, 02.11.2026).
//
// Rasmdagi tartib: ism + «lavozim · N ta filial», «Mening profilim», «Parol va
// xavfsizlik», «Ko'rinish» (Til — ichki ro'yxat, Tema — quyosh/oy), «Chiqish».
// RASMDAN FARQ (design/v2/SAVOLLAR.md, 21-qism): «Eski versiyaga qaytish» va
// «Qulflash» qoldi — eski/yangi almashtirgich boshqa joyda yo'q, qulflash esa
// mavjud imkoniyat. «Aktiv qurilmalar» — «Parol va xavfsizlik» sahifasida.

const PANEL =
  "absolute right-0 top-full z-50 mt-2 overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-md max-sm:fixed max-sm:inset-x-3 max-sm:top-[4.25rem] max-sm:mt-0 max-sm:w-auto";
// Rang va hover — alohida: bitta qatorda ikki `text-*` / `hover:bg-*` bo'lsa qaysi biri yutishi
// CSS tartibiga bog'liq (sinfdagi tartibga emas) — «Chiqish» qizil chiqmay qolardi.
const ROW_BASE = "flex w-full items-center gap-3 rounded-v2-md px-2.5 py-2 text-left text-v2-body transition-colors focus-visible:outline-none";
const ROW = `${ROW_BASE} text-v2-text hover:bg-v2-hover focus-visible:bg-v2-hover`;
const ROW_DANGER = `${ROW_BASE} text-v2-danger hover:bg-v2-danger-bg focus-visible:bg-v2-danger-bg`;
const ICON = "size-4 shrink-0 text-v2-text-2";

/** Ism-familiyaning bosh harflari: «Asadbek Karimov» → «AK». */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join("") || "?";
}

export default function ProfileMenuV2({ user }: { user: ShellUserV2 | null }) {
  const { t } = useT();
  const router = useRouter();
  const [lang, setLang] = useLang();
  const [isDark, toggleTheme] = useTheme();
  const { open, ref, toggle, close } = usePopover();
  const [view, setView] = useState<"main" | "lang">("main");
  const { branchId, branches } = useBranch();

  const displayName = user?.fullName?.trim() || "—";
  const initials = initialsOf(user?.fullName ?? "");
  const role = user?.roleLabel ? t(user.roleLabel) : "";

  // Hovuzdagi binolar (Chortoq 1+2) bitta filial bo'lib sanaladi — yon menyudagi ro'yxat bilan bir xil.
  const visibleBranches = useMemo(() => collapseBranchPools(branches, branchId), [branches, branchId]);
  const branchNote =
    visibleBranches.length > 1
      ? t("{n} ta filial", { n: visibleBranches.length })
      : visibleBranches[0]?.name ?? "";

  const onToggle = () => {
    setView("main");
    toggle();
  };

  const lock = async () => {
    close();
    await fetch("/api/auth/lock", { method: "POST" }).catch(() => {});
    router.replace("/lock");
    router.refresh();
  };
  const logout = async () => {
    close();
    if (!confirm(t("Tizimdan chiqishni xohlaysizmi?"))) return;
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/");
    router.refresh();
  };
  const setDark = (dark: boolean) => {
    if (dark !== isDark) toggleTheme();
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={onToggle}
        aria-haspopup="menu"
        aria-expanded={open}
        title={displayName}
        className={`flex h-10 items-center gap-2.5 rounded-v2-md pl-1 pr-1 transition-colors hover:bg-v2-surface-2 xl:pr-2 ${open ? "bg-v2-surface-2" : ""}`}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-v2-full bg-v2-brand text-v2-caption font-semibold text-v2-on-brand">{initials}</span>
        <span className="hidden min-w-0 text-left xl:block">
          <span className="block max-w-[160px] truncate text-v2-body font-semibold text-v2-text">{displayName}</span>
          {role && <span className="block max-w-[160px] truncate text-v2-caption text-v2-text-3">{role}</span>}
        </span>
        <ChevronDown className={`hidden size-4 shrink-0 text-v2-text-3 transition-transform xl:block ${open ? "rotate-180" : ""}`} strokeWidth={1.75} aria-hidden />
      </button>

      {open && (
        <div role="menu" aria-label={displayName} className={`${PANEL} w-72`}>
          {view === "lang" ? (
            <div className="p-1.5">
              <button type="button" onClick={() => setView("main")} className={ROW}>
                <ChevronLeft className={ICON} strokeWidth={1.75} />
                <span className="font-semibold text-v2-text">{t("Til")}</span>
              </button>
              <div className="my-1 h-px bg-v2-border" />
              {LANG_CODES.map((code) => (
                <button
                  key={code}
                  type="button"
                  role="menuitemradio"
                  aria-checked={lang === code}
                  onClick={() => {
                    setLang(code);
                    setView("main");
                  }}
                  className={ROW}
                >
                  <span className="w-7 text-v2-caption font-semibold text-v2-text-3">{LANGUAGES[code].code}</span>
                  <span className="min-w-0 flex-1 truncate">{LANGUAGES[code].name}</span>
                  {lang === code && <Check className="size-4 text-v2-brand-text" strokeWidth={2} />}
                </button>
              ))}
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-v2-border p-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-v2-full bg-v2-brand text-v2-body font-semibold text-v2-on-brand">{initials}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-v2-body font-semibold text-v2-text" title={displayName}>
                    {displayName}
                  </span>
                  <span className="block truncate text-v2-caption text-v2-text-3">{[role, branchNote].filter(Boolean).join(" · ")}</span>
                </span>
              </div>

              <div className="border-b border-v2-border p-1.5">
                <Link href="/settings-profile" role="menuitem" onClick={close} className={ROW}>
                  <UserRound className={ICON} strokeWidth={1.75} />
                  {t("Mening profilim")}
                </Link>
                <Link href="/settings-security" role="menuitem" onClick={close} className={ROW}>
                  <LockKeyhole className={ICON} strokeWidth={1.75} />
                  {t("Parol va xavfsizlik")}
                </Link>
              </div>

              <div className="border-b border-v2-border p-1.5">
                <div className="px-2.5 pb-1 pt-1 text-v2-caption text-v2-text-3">{t("Ko'rinish")}</div>
                <button type="button" onClick={() => setView("lang")} className={ROW}>
                  <Globe className={ICON} strokeWidth={1.75} />
                  <span className="min-w-0 flex-1">{t("Til")}</span>
                  <span className="text-v2-small text-v2-text-2">{LANGUAGES[lang]?.name ?? lang}</span>
                  <ChevronRight className="size-4 shrink-0 text-v2-text-3" strokeWidth={1.75} />
                </button>
                <div className="flex items-center gap-3 px-2.5 py-1.5 text-v2-body text-v2-text">
                  <Contrast className={ICON} strokeWidth={1.75} />
                  <span className="min-w-0 flex-1">{t("Tema")}</span>
                  <span role="group" aria-label={t("Tema")} className="flex gap-0.5 rounded-v2-md border border-v2-border bg-v2-surface-2 p-0.5">
                    <button
                      type="button"
                      onClick={() => setDark(false)}
                      aria-pressed={!isDark}
                      title={t("Yorug' rejim")}
                      aria-label={t("Yorug' rejim")}
                      className={`inline-flex size-7 items-center justify-center rounded-[6px] transition-colors ${
                        !isDark ? "bg-v2-surface text-v2-text shadow-v2-sm" : "text-v2-text-3 hover:text-v2-text"
                      }`}
                    >
                      <Sun className="size-4" strokeWidth={1.75} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDark(true)}
                      aria-pressed={isDark}
                      title={t("Tungi rejim")}
                      aria-label={t("Tungi rejim")}
                      className={`inline-flex size-7 items-center justify-center rounded-[6px] transition-colors ${
                        isDark ? "bg-v2-surface text-v2-text shadow-v2-sm" : "text-v2-text-3 hover:text-v2-text"
                      }`}
                    >
                      <Moon className="size-4" strokeWidth={1.75} />
                    </button>
                  </span>
                </div>
              </div>

              <div className="p-1.5">
                <button type="button" role="menuitem" onClick={() => switchUiVersion("v1")} className={ROW}>
                  <RotateCcw className={ICON} strokeWidth={1.75} />
                  {t("Eski versiyaga qaytish")}
                </button>
                <button type="button" role="menuitem" onClick={() => void lock()} className={ROW}>
                  <Lock className={ICON} strokeWidth={1.75} />
                  {t("Qulflash")}
                </button>
                <button type="button" role="menuitem" onClick={() => void logout()} className={ROW_DANGER}>
                  <LogOut className="size-4 shrink-0" strokeWidth={1.75} />
                  {t("Chiqish")}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
