"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown, Sparkles } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { EFFORT_LABELS, effortLabel } from "@/lib/ai/models";
import type { AiModelOption } from "@/lib/ai/protocol";
import type { AiChoice } from "./useAiChat";

// MODEL VA «TEZLIK» TANLOVI (08.10.2026) — yozish maydoni ichidagi tugma,
// ChatGPT'dagi kabi. Bosilsa yuqoriga ro'yxat ochiladi:
//   • modellar — admin ochgan va OpenAI hisobida borlari (GET /api/ai/status);
//   • «Tezlik» surgichi — tanlangan model qabul qiladigan darajalar
//     (Tezkor → Chuqur). Model darajani qo'llamasa (proksi rejimi) — yo'q.
// Tanlov keyingi savoldan kuchga kiradi va shu qurilmada eslab qolinadi
// (components/ai/useAiChat.ts). Ro'yxat silliq ochiladi va silliq yopiladi
// (`.ai-pop-out`, 6-bosqich).

/** Yopilish animatsiyasi (`.ai-pop-out`, app/globals.css) bilan bir xil. */
const CLOSE_MS = 120;

export default function ModelPicker({
  models,
  choice,
  onChange,
  disabled = false,
  compact = false,
}: {
  models: AiModelOption[];
  choice: AiChoice;
  onChange: (next: Partial<AiChoice>) => void;
  disabled?: boolean;
  /** Suzuvchi oynada — ro'yxat pastroq (oyna ichiga sig'sin). */
  compact?: boolean;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  /** Yopilish animatsiyasi ketyapti — ro'yxat hali chizilgan, lekin so'nyapti. */
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const model = models.find((m) => m.id === choice.model);
  const shown = open && !closing;

  const close = useCallback(() => {
    if (closeTimer.current !== null) return;
    setClosing(true);
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = null;
      setOpen(false);
      setClosing(false);
    }, reduced ? 0 : CLOSE_MS);
  }, []);
  /** Ochish (yopilayotgan bo'lsa — yopilish bekor bo'ladi). */
  const reopen = () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
    setClosing(false);
    setOpen(true);
  };
  useEffect(() => () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
  }, []);

  // Tashqariga bosilsa yopiladi.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open, close]);

  if (!model) return null;
  const efforts = model.efforts;
  const interactive = models.length > 1 || efforts.length > 1;
  const at = choice.effort ? efforts.indexOf(choice.effort) : -1;
  const hint = EFFORT_LABELS.find((x) => x.effort === choice.effort)?.hint;

  // Esc — faqat ro'yxatni yopadi (panel yopilib ketmasin).
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape" && open) {
      e.stopPropagation();
      close();
    }
  };

  return (
    <div ref={rootRef} className="relative min-w-0" onKeyDown={onKeyDown}>
      <button
        type="button"
        disabled={disabled || !interactive}
        onClick={() => (shown ? close() : reopen())}
        aria-haspopup="dialog"
        aria-expanded={shown}
        title={t("Model va tezlik")}
        className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-secondary/50 px-3 py-1.5 text-[12px] font-medium text-foreground/80 transition-colors hover:bg-secondary disabled:cursor-default disabled:hover:bg-secondary/50"
      >
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span className="truncate">
          {model.name}
          {choice.effort && <span className="text-muted-foreground"> · {t(effortLabel(choice.effort))}</span>}
        </span>
        {interactive && <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${shown ? "rotate-180" : ""}`} />}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t("Model va tezlik")}
          className={`${closing ? "ai-pop-out" : "ui-pop-in ui-pop-up"} absolute bottom-full left-0 z-20 mb-2 w-[min(330px,calc(100vw-32px))] rounded-2xl border border-border bg-card p-2 shadow-xl`}
        >
          <div className="px-2 pb-1 pt-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("Model")}</div>
          <div className={`space-y-0.5 overflow-y-auto overscroll-contain ${compact ? "max-h-[170px]" : "max-h-[260px]"}`}>
            {models.map((m) => {
              const active = m.id === model.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onChange({ model: m.id })}
                  aria-pressed={active}
                  className={`flex w-full items-start gap-2 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-secondary ${active ? "bg-secondary/70" : ""}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium">{m.name}</span>
                    {m.hint && <span className="block text-[11px] leading-snug text-muted-foreground">{t(m.hint)}</span>}
                  </span>
                  {active && <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />}
                </button>
              );
            })}
          </div>

          {efforts.length > 1 && at >= 0 && (
            <div className="mt-1.5 border-t border-border px-2 pb-1 pt-2">
              <div className="flex items-center justify-between text-[12px]">
                <span className="font-semibold">{t("Tezlik")}</span>
                <span className="font-medium text-primary">{t(effortLabel(efforts[at]))}</span>
              </div>
              <input
                type="range"
                min={0}
                max={efforts.length - 1}
                step={1}
                value={at}
                onChange={(e) => onChange({ effort: efforts[Number(e.target.value)] })}
                aria-label={t("Tezlik")}
                aria-valuetext={t(effortLabel(efforts[at]))}
                className="mt-2 w-full cursor-pointer accent-primary"
              />
              <div className="mt-0.5 flex justify-between text-[10px] text-muted-foreground">
                {efforts.map((e) => (
                  <button key={e} type="button" onClick={() => onChange({ effort: e })} className="hover:text-foreground">
                    {t(effortLabel(e))}
                  </button>
                ))}
              </div>
              {hint && <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">{t(hint)}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
