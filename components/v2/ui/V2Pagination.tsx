"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { getPageButtons } from "@/lib/pagination";
import V2Select from "./V2Select";

// YANGI VERSIYA: SAHIFALASH (design/v2/DESIGN.md → «Tablar va almashtirgichlar»
// → Sahifalash): chapda «1–50 / 580 ta», o'rtada sahifalar (faol — brend),
// strelkalar ikkinchi darajali ikonka tugma, «…» oraliq, o'ngda «50 qator».
// Sahifa tugmalari eski components/ui/Pagination.tsx bilan bir manbadan
// (lib/pagination.ts → getPageButtons). Bitta sahifa bo'lsa tugmalar yo'q.

const PAGE_SIZES = [50, 100, 200];

function fmt(n: number): string {
  return n.toLocaleString("ru-RU").replace(/,/g, " ");
}

export default function V2Pagination({
  totalItems,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  totalItems: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  const { t } = useT();
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const from = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(totalItems, page * pageSize);
  const arrow =
    "inline-flex size-8 items-center justify-center rounded-v2-md border border-v2-border-strong bg-v2-surface text-v2-text-2 transition-colors hover:bg-v2-surface-2 hover:text-v2-text disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-v2-surface";

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-3 border-t border-v2-border px-4 py-2.5">
      <span className="text-v2-small tabular-nums text-v2-text-2">
        {t("{from}–{to} / {total} ta", { from: fmt(from), to: fmt(to), total: fmt(totalItems) })}
      </span>

      {totalPages > 1 && (
        <nav aria-label={t("Sahifalar")} className="mx-auto flex items-center gap-1">
          <button type="button" onClick={() => onPageChange(page - 1)} disabled={page === 1} className={arrow} aria-label={t("Oldingi")} title={t("Oldingi")}>
            <ChevronLeft className="size-4" strokeWidth={1.75} />
          </button>
          {getPageButtons(page, totalPages).map((p, i) =>
            p === "..." ? (
              <span key={`e${i}`} className="inline-flex h-8 min-w-6 items-center justify-center text-v2-small text-v2-text-3" aria-hidden>
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                aria-current={p === page ? "page" : undefined}
                className={`h-8 min-w-8 rounded-v2-md px-2 text-v2-small tabular-nums transition-colors ${
                  p === page ? "bg-v2-brand font-semibold text-v2-on-brand" : "text-v2-text hover:bg-v2-surface-2"
                }`}
              >
                {p}
              </button>
            ),
          )}
          <button type="button" onClick={() => onPageChange(page + 1)} disabled={page === totalPages} className={arrow} aria-label={t("Keyingi")} title={t("Keyingi")}>
            <ChevronRight className="size-4" strokeWidth={1.75} />
          </button>
        </nav>
      )}

      <div className={`w-[118px] ${totalPages > 1 ? "" : "ml-auto"}`}>
        <V2Select
          label={t("Sahifadagi qatorlar")}
          value={String(pageSize)}
          onChange={(v) => v && onPageSizeChange(Number(v))}
          options={PAGE_SIZES.map((s) => ({ value: String(s), label: t("{n} qator", { n: s }) }))}
          searchable={false}
          clearable={false}
        />
      </div>
    </div>
  );
}
