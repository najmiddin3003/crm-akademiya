"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { NEWS_ICON_VIEW } from "@/components/v2/sales/newsIcons";
import type { CabinetFeedItem } from "@/lib/cabinetNewsTypes";
import { Card, useCabinetFmt } from "./bits";

// O'QUVCHI KABINETI — YANGILIKLAR VA HIKOYALAR (36-qism, rasm «Kabinet — yangilik»).
// Tepada hikoya doiralari (24 soat; bosilsa to'liq ochiladi), pastda «Yangiliklar» lentasi. Ko'rilganlari
// /api/student-web/seen ga yuboriladi — admin sahifasidagi «Ko'rdi» shundan.

function seen(initData: string, ids: number[]) {
  if (!ids.length) return;
  void fetch("/api/student-web/seen", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ initData, ids }) }).catch(() => {});
}

/** Toshkent vaqti bo'yicha «Bugun, 18:30» yoki «10-oktabr». */
function useWhen() {
  const { t } = useT();
  const fmt = useCabinetFmt();
  return (iso: string, today: string) => {
    const d = new Date(Date.parse(iso) + 5 * 3600_000).toISOString();
    return d.slice(0, 10) === today ? `${t("Bugun")}, ${d.slice(11, 16)}` : fmt.dayMonth(d.slice(0, 10));
  };
}

export function StoriesStrip({ items, initData }: { items: CabinetFeedItem[]; initData: string }) {
  const { t } = useT();
  const [open, setOpen] = useState<CabinetFeedItem | null>(null);
  const [viewed, setViewed] = useState<Set<number>>(() => new Set());
  if (!items.length) return null;
  const show = (s: CabinetFeedItem) => {
    setOpen(s);
    setViewed((v) => new Set(v).add(s.id));
    seen(initData, [s.id]);
  };
  return (
    <>
      <div className="-mx-1 mb-4 flex gap-3 overflow-x-auto px-1 pb-1" role="list" aria-label={t("Hikoyalar")}>
        {items.map((s) => {
          const v = NEWS_ICON_VIEW[s.icon];
          return (
            <button key={s.id} type="button" role="listitem" onClick={() => show(s)} className="flex w-[76px] shrink-0 flex-col items-center gap-1.5 text-center">
              <span className={`flex size-[68px] items-center justify-center rounded-full border-[3px] p-0.5 ${viewed.has(s.id) ? "border-v2-border-strong" : "border-v2-brand"}`}>
                {s.image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- tashqi rasm (Cloudinary)
                  <img src={s.image} alt="" className="size-full rounded-full object-cover" />
                ) : (
                  <span className={`flex size-full items-center justify-center rounded-full ${v.bg} ${v.tx}`}>
                    <v.Icon className="size-6" strokeWidth={1.75} aria-hidden />
                  </span>
                )}
              </span>
              <span className="line-clamp-2 text-v2-caption leading-tight text-v2-text-2">{s.title}</span>
            </button>
          );
        })}
      </div>
      {open && (
        <div role="dialog" aria-modal="true" aria-label={open.title} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setOpen(null)}>
          <div className="relative w-full max-w-sm overflow-hidden rounded-v2-lg bg-v2-surface" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setOpen(null)} aria-label={t("Yopish")} className="absolute right-2 top-2 z-10 flex size-9 items-center justify-center rounded-full bg-black/40 text-white">
              <X className="size-5" aria-hidden />
            </button>
            {open.image ? (
              // eslint-disable-next-line @next/next/no-img-element -- tashqi rasm (Cloudinary)
              <img src={open.image} alt="" className="aspect-[9/12] w-full object-cover" />
            ) : (
              <div className={`flex aspect-[9/10] w-full items-center justify-center ${NEWS_ICON_VIEW[open.icon].bg} ${NEWS_ICON_VIEW[open.icon].tx}`}>
                {(() => {
                  const I = NEWS_ICON_VIEW[open.icon].Icon;
                  return <I className="size-16" strokeWidth={1.5} aria-hidden />;
                })()}
              </div>
            )}
            <div className="p-4">
              <div className="text-[17px] font-semibold text-v2-text">{open.title}</div>
              {open.body && <p className="mt-1 whitespace-pre-line text-v2-small text-v2-text-2">{open.body}</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function NewsFeed({ items, initData, today }: { items: CabinetFeedItem[]; initData: string; today: string }) {
  const { t } = useT();
  const when = useWhen();
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    seen(
      initData,
      items.map((n) => n.id),
    );
  }, [initData, items]);
  if (!items.length) return null;
  return (
    <div>
      <h2 className="mb-2 text-v2-small font-semibold text-v2-text-2">{t("Yangiliklar")}</h2>
      <div className="flex flex-col gap-3">
        {items.map((n) => {
          const v = NEWS_ICON_VIEW[n.icon];
          return (
            <Card key={n.id} className="overflow-hidden !p-0 sm:!p-0">
              {n.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- tashqi rasm (Cloudinary)
                <img src={n.image} alt="" className="aspect-[16/9] w-full object-cover" />
              ) : (
                <div className={`flex h-24 items-end px-4 pb-3 ${v.bg}`}>
                  <span className={`text-v2-caption font-bold uppercase tracking-wide ${v.tx}`}>{t(v.label)}</span>
                </div>
              )}
              <div className="p-4">
                <div className="font-semibold text-v2-text">{n.title}</div>
                {n.body && <p className="mt-1 whitespace-pre-line text-v2-small text-v2-text-2">{n.body}</p>}
                <div className="mt-2 text-v2-caption text-v2-text-3">{when(n.publishAt, today)}</div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
