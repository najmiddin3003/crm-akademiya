"use client";

import { useState } from "react";
import { getPageButtons } from "@/lib/pagination";
import { useT } from "@/components/shared/Language";

// Ported from crm-akademiya/src/app.js renderPagination()/getPageButtons() (~line 22910).
// Shared by every list page (Orders, First lessons, ...) — "hamma joylari bir
// xil ishlashi kerak": bitta Pagination komponenti hammasida qayta ishlatiladi.

const PAGE_SIZES = [50, 100, 200];

export interface PaginationProps {
  totalItems: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export default function Pagination({ totalItems, page, pageSize, onPageChange, onPageSizeChange }: PaginationProps) {
  const { t } = useT();
  const [sizeMenuOpen, setSizeMenuOpen] = useState(false);
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const pages = getPageButtons(page, totalPages);

  return (
    <div className="flex items-center justify-end gap-1.5 px-4 py-2.5 border-t border-border flex-wrap">
      <div className="relative mr-2">
        <button
          type="button"
          onClick={() => setSizeMenuOpen((o) => !o)}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-card hover:bg-secondary text-[13px] font-medium"
        >
          <svg className="icon icon-xs text-muted-foreground"><use href="#i-list" /></svg>
          <span>{pageSize} qator</span>
          <svg className="icon icon-xs text-muted-foreground"><use href="#i-chevron-down" /></svg>
        </button>
        {sizeMenuOpen && (
          <div className="absolute bottom-full right-0 mb-1 rounded-lg border border-border bg-card shadow-xl p-1 z-50 w-36">
            {PAGE_SIZES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => { onPageSizeChange(s); setSizeMenuOpen(false); }}
                className={`w-full text-left px-3 py-1.5 rounded-md hover:bg-secondary text-sm ${s === pageSize ? "bg-primary/10 text-primary font-semibold" : ""}`}
              >
                {s} qator
              </button>
            ))}
          </div>
        )}
      </div>

      <button type="button" onClick={() => onPageChange(1)} disabled={page === 1} className="h-8 w-8 rounded-md hover:bg-secondary flex items-center justify-center text-muted-foreground disabled:opacity-40 disabled:cursor-not-allowed text-[15px]" title={t("Birinchi")}>«</button>
      <button type="button" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1} className="h-8 w-8 rounded-md hover:bg-secondary flex items-center justify-center text-muted-foreground disabled:opacity-40 disabled:cursor-not-allowed text-[15px]" title={t("Oldingi")}>‹</button>

      <div className="inline-flex items-center gap-0.5 mx-0.5">
        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`e${i}`} className="inline-flex items-center justify-center h-8 px-1 text-muted-foreground text-sm">…</span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              className={`h-8 min-w-8 px-2 rounded-md text-sm tabular-nums transition-colors ${p === page ? "bg-primary text-white font-semibold shadow-sm" : "hover:bg-secondary text-foreground"}`}
            >
              {p}
            </button>
          ),
        )}
      </div>

      <button type="button" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="h-8 w-8 rounded-md hover:bg-secondary flex items-center justify-center text-muted-foreground disabled:opacity-40 disabled:cursor-not-allowed text-[15px]" title={t("Keyingi")}>›</button>
      <button type="button" onClick={() => onPageChange(totalPages)} disabled={page === totalPages} className="h-8 w-8 rounded-md hover:bg-secondary flex items-center justify-center text-muted-foreground disabled:opacity-40 disabled:cursor-not-allowed text-[15px]" title={t("Oxirgi")}>»</button>
    </div>
  );
}
