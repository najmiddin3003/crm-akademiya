"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { AlertCircle, ArrowRight, Loader2 } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { primaryBtn } from "@/components/v2/ui/buttons";
import { AuthLogo } from "./AuthBrandPanel";

// YANGI VERSIYA — KIRISHDAN KEYIN FILIAL TANLASH (rasm «Filial tanlash», yorug'/qorong'i, 25.10.2026,
// 14-qism): «Xush kelibsiz, Abdulloh! Qaysi filialda ishlaysiz?» — filiallar (raqam kvadrati, nomi,
// lavozim, «oxirgi marta shu yerda»), o'ngda radio; «Davom ettirish →»; pastda «Filialni keyin chap
// yuqoridagi filial menyusidan almashtirish mumkin». Bitta filiali bor xodimga ko'rsatilmaydi
// (LoginV2 to'g'ri bosh sahifaga o'tadi). Tanlov — POST /api/branch (navbardagi bilan bir xil).
// «Davom etish» emas: u kalit oynalarda «Keep editing» ma'nosida band (bitta kalit — bitta ma'no).

export interface BranchChoice {
  id: number;
  name: string;
  role: string;
  /** `role` tarjima kalitimi (umumiy lavozim) yoki Rollar'dagi nom. */
  roleKey: boolean;
}

export default function BranchPickV2({
  name,
  branches,
  lastBranchId,
  onDone,
}: {
  name: string;
  branches: BranchChoice[];
  lastBranchId: number | null;
  onDone: () => void;
}) {
  const { t } = useT();
  const [sel, setSel] = useState<number>(() => (lastBranchId !== null && branches.some((b) => b.id === lastBranchId) ? lastBranchId : branches[0]?.id ?? 0));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  async function go() {
    if (busy || !sel) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/branch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ branchId: sel }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.ok) {
        setError(t(d.error || "Filialni tanlab bo'lmadi"));
        setBusy(false);
        return;
      }
      onDone();
    } catch {
      setError(t("Server bilan bog'lanib bo'lmadi"));
      setBusy(false);
    }
  }

  function onKey(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    if (e.key === "Enter") {
      e.preventDefault();
      void go();
      return;
    }
    const step = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const j = (i + step + branches.length) % branches.length;
    setSel(branches[j].id);
    refs.current[j]?.focus();
  }

  return (
    <div data-ui="v2" className="flex min-h-dvh items-center justify-center bg-v2-bg p-4 font-v2 text-v2-text">
      <div className="w-full max-w-[420px] rounded-v2-lg border border-v2-border bg-v2-surface p-6 shadow-v2-md sm:p-7">
        <AuthLogo />
        <h1 className="mt-5 text-[22px] font-semibold leading-7 text-v2-text">{name ? t("Xush kelibsiz, {name}!", { name }) : t("Xush kelibsiz!")}</h1>
        <p className="mt-1 text-v2-small text-v2-text-2">{t("Qaysi filialda ishlaysiz?")}</p>

        <div role="radiogroup" aria-label={t("Filial")} className="mt-5 space-y-2.5">
          {branches.map((b, i) => {
            const on = b.id === sel;
            return (
              <button
                key={b.id}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                type="button"
                role="radio"
                aria-checked={on}
                tabIndex={on ? 0 : -1}
                onClick={() => setSel(b.id)}
                onDoubleClick={() => void go()}
                onKeyDown={(e) => onKey(e, i)}
                className={`flex w-full items-center gap-3 rounded-v2-lg border px-3.5 py-3 text-left transition-colors focus-visible:outline-none focus-visible:shadow-v2-focus ${
                  on ? "border-v2-brand bg-v2-brand-bg" : "border-v2-border bg-v2-surface hover:bg-v2-surface-2"
                }`}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-v2-md border border-v2-border bg-v2-surface-2 text-v2-small font-semibold tabular-nums text-v2-text" aria-hidden>
                  {b.id}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-v2-body font-semibold text-v2-text">{b.name}</span>
                  <span className="block truncate text-v2-caption font-normal text-v2-text-2">{b.roleKey ? t(b.role) : b.role}</span>
                  {b.id === lastBranchId && <span className="mt-0.5 block text-v2-caption font-medium text-v2-brand-text">{t("oxirgi marta shu yerda")}</span>}
                </span>
                <span className={`flex size-[18px] shrink-0 items-center justify-center rounded-full border-2 ${on ? "border-v2-brand" : "border-v2-border-strong"}`} aria-hidden>
                  {on && <span className="size-2 rounded-full bg-v2-brand" />}
                </span>
              </button>
            );
          })}
        </div>

        {error && (
          <p role="alert" className="mt-4 flex items-start gap-2 rounded-v2-md bg-v2-danger-bg px-3 py-2 text-v2-small text-v2-danger">
            <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden />
            {error}
          </p>
        )}

        <button type="button" onClick={() => void go()} disabled={busy || !sel} className={`${primaryBtn} mt-5 h-11 w-full justify-center disabled:opacity-60`}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {t("Davom ettirish")}
          {!busy && <ArrowRight className="size-4" strokeWidth={2} aria-hidden />}
        </button>
        <p className="mt-4 text-balance text-center text-v2-caption font-normal text-v2-text-2">{t("Filialni keyin chap yuqoridagi filial menyusidan almashtirish mumkin")}</p>
      </div>
    </div>
  );
}
