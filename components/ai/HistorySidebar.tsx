"use client";

import { useMemo, useState } from "react";
import { Check, MessageSquare, Search, SquarePen, Trash2, X } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { filterHistory, groupHistory, HISTORY_GROUPS, type AiHistoryItem } from "./history";

// SUHBATLAR TARIXI — to'liq ekranda chap tomonda (08.10.2026, ChatGPT'dagi
// kabi): «Yangi suhbat», nom bo'yicha qidiruv, sana guruhlari (Bugun,
// Kecha …). Bosilsa suhbat ochiladi, savatcha — o'chiradi (ikkinchi bosish
// bilan tasdiqlanadi). Javob kelayotganda boshqa suhbatga o'tib bo'lmaydi.
//
// Ochilib-yopilishi CSS'da (`.ai-side`, app/globals.css): kompyuterda eni
// silliq o'zgaradi, telefonda chapdan suriladigan parda bo'ladi. Yopiq
// panel `inert` — Tab bilan ichiga kirilmaydi.

export default function HistorySidebar({
  open,
  items,
  at,
  activeId,
  busy,
  onOpen,
  onNew,
  onDelete,
  onDismiss,
}: {
  open: boolean;
  /** `null` — ro'yxat hali yuklanmoqda. */
  items: AiHistoryItem[] | null;
  /** Ro'yxat olingan vaqt (ms) — guruhlash shunga nisbatan (render ichida soat o'qilmaydi). */
  at: number;
  activeId: string;
  busy: boolean;
  onOpen: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  /** Telefonda — pardani yopish (orqa fon bosilganda). */
  onDismiss: () => void;
}) {
  const { t } = useT();
  const [query, setQuery] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const groups = useMemo(() => (items ? groupHistory(filterHistory(items, query), new Date(at)) : []), [items, query, at]);
  const labelOf = (g: string) => HISTORY_GROUPS.find((x) => x.group === g)?.label ?? g;

  return (
    <>
      {/* Telefonda parda ochiq bo'lsa — orqasi xiralashadi, bosilsa yopiladi. */}
      <div aria-hidden className={`ai-side-scrim md:hidden ${open ? "" : "pointer-events-none opacity-0"}`} onClick={onDismiss} />
      <aside className="ai-side" data-open={open ? "" : undefined} inert={!open} aria-label={t("Suhbatlar tarixi")}>
        <div className="ai-side-inner flex flex-col">
          <div className="space-y-2 p-3">
            <button
              type="button"
              onClick={onNew}
              disabled={busy}
              className="flex w-full items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-[13px] font-medium shadow-sm transition-colors hover:bg-secondary disabled:opacity-50"
            >
              <SquarePen className="h-4 w-4 text-primary" />
              {t("Yangi suhbat")}
            </button>
            <label className="flex items-center gap-2 rounded-xl border border-border bg-card/60 px-2.5 py-1.5 text-[12px] focus-within:border-primary/40">
              <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value.slice(0, 80))}
                placeholder={t("Suhbatlarni qidirish")}
                aria-label={t("Suhbatlarni qidirish")}
                className="min-w-0 flex-1 bg-transparent focus:outline-none"
              />
              {query && (
                <button type="button" onClick={() => setQuery("")} title={t("Tozalash")} aria-label={t("Tozalash")} className="text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </label>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-3">
            {items === null ? (
              <div className="space-y-2 px-2 pt-2" aria-hidden>
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-7 animate-pulse rounded-lg bg-secondary/70" style={{ width: `${88 - i * 9}%` }} />
                ))}
              </div>
            ) : groups.length === 0 ? (
              <p className="px-2 pt-3 text-[12px] text-muted-foreground">{query ? t("Hech narsa topilmadi") : t("Hali suhbatlar yo'q")}</p>
            ) : (
              groups.map((g) => (
                <section key={g.group} className="pt-2">
                  <h4 className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t(labelOf(g.group))}</h4>
                  <ul className="space-y-0.5">
                    {g.items.map((it) => {
                      const active = it.id === activeId;
                      const asking = confirmId === it.id;
                      return (
                        <li
                          key={it.id}
                          className={`ai-side-row flex items-center gap-1 rounded-lg pr-1 transition-colors ${
                            active ? "bg-primary/10 text-foreground" : "hover:bg-secondary/80"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => onOpen(it.id)}
                            disabled={busy && !active}
                            title={it.title || t("Nomsiz suhbat")}
                            aria-current={active ? "true" : undefined}
                            className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-[13px] disabled:opacity-50"
                          >
                            <MessageSquare className={`h-3.5 w-3.5 shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`} />
                            <span className={`truncate ${active ? "font-medium" : ""}`}>{it.title || t("Nomsiz suhbat")}</span>
                          </button>
                          {asking ? (
                            <span className="flex shrink-0 items-center gap-0.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setConfirmId(null);
                                  onDelete(it.id);
                                }}
                                title={t("O'chirish")}
                                aria-label={t("O'chirish")}
                                className="rounded-md p-1 text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-500/20"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmId(null)}
                                title={t("Bekor qilish")}
                                aria-label={t("Bekor qilish")}
                                className="rounded-md p-1 text-muted-foreground hover:bg-secondary"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmId(it.id)}
                              disabled={busy && active}
                              title={t("Suhbatni o'chirish")}
                              aria-label={t("Suhbatni o'chirish")}
                              className="ai-side-del shrink-0 rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-rose-600 disabled:hidden"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))
            )}
          </div>

          <p className="border-t border-border/70 px-3 py-2 text-[11px] text-muted-foreground">{t("Suhbatlar 30 kun saqlanadi")}</p>
        </div>
      </aside>
    </>
  );
}
