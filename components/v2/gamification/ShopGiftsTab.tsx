"use client";

import { useState } from "react";
import { Check, Gift, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { itemTitleT, type ShopItemView } from "@/components/gamification/shop/ShopModals";
import ActionMenu, { type ActionMenuEntry } from "@/components/v2/ui/ActionMenu";
import { EmptyBlock, secondarySm } from "@/components/v2/students/profile/profileBits";
import { CoinValue, GiftIcon } from "./gamBits";
import { stockInScope } from "./shopTypes";

// YANGI VERSIYA — DO'KON · SOVG'ALAR (rasm «Do'kon · Sovg'alar», yorug'/qorong'i,
// 24.10.2026): qidiruv «Sovg'a nomi» + chiplar «Hammasi · 7 | Mavjud · 6 | Tugagan · 1»;
// kartochkalar — tepasi `brand-bg` da chiziqli ikonka (rasm bo'lsa — rasm; tugagani kulrang),
// nom, narx, «qoldiq N ta» / «Tugagan», «✎ Tahrirlash» + «⋯»; oxirida uzuq chegarali
// «+ Sovg'a qo'shish». Katalogni faqat direktor o'zgartiradi (lib/gamification/shop.ts);
// filial admini — «O'quvchiga berish», ustoz — faqat ko'radi.

type Filter = "all" | "in" | "out";

export default function ShopGiftsTab({
  items,
  branchIds,
  role,
  onAdd,
  onEdit,
  onGive,
  onDelete,
}: {
  items: ShopItemView[];
  branchIds: number[];
  role: "director" | "branch_admin" | "teacher";
  onAdd: () => void;
  onEdit: (i: ShopItemView) => void;
  onGive: (i: ShopItemView) => void;
  onDelete: (i: ShopItemView) => void;
}) {
  const { t } = useT();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const director = role === "director";
  const canGive = role !== "teacher";

  const withStock = items.map((i) => ({ i, stock: stockInScope(i, branchIds) }));
  const out = withStock.filter((x) => x.stock === 0).length;
  const needle = q.trim().toLowerCase();
  const list = withStock.filter(
    ({ i, stock }) =>
      (filter === "all" || (filter === "out" ? stock === 0 : stock !== 0)) && (!needle || `${itemTitleT(t, i)} ${i.name}`.toLowerCase().includes(needle)),
  );

  const chip = (key: Filter, label: string, n: number) => {
    const on = filter === key;
    return (
      <button
        key={key}
        type="button"
        aria-pressed={on}
        onClick={() => setFilter(key)}
        className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-v2-full border px-3 text-v2-small font-medium transition-colors ${
          on ? "border-v2-brand bg-v2-brand-bg text-v2-brand-text" : "border-v2-border-strong bg-v2-surface text-v2-text hover:bg-v2-surface-2"
        }`}
      >
        {on && <Check className="size-3.5" strokeWidth={2.25} aria-hidden />}
        {label} · <span className="tabular-nums">{n}</span>
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full min-[40rem]:w-[17rem]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-v2-text-3" strokeWidth={1.75} aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("Sovg'a nomi")}
            aria-label={t("Sovg'a nomi bo'yicha qidirish")}
            className="h-9 w-full rounded-v2-md border border-v2-border-field bg-v2-surface! pl-9 pr-3 text-v2-body text-v2-text placeholder:text-v2-text-3 transition-[border-color,box-shadow] focus:border-v2-brand focus:shadow-v2-focus focus:outline-none"
          />
        </div>
        <div className="flex max-w-full items-center gap-2 overflow-x-auto [scrollbar-width:none]" role="group" aria-label={t("Holat")}>
          {chip("all", t("Hammasi"), items.length)}
          {chip("in", t("Mavjud"), items.length - out)}
          {chip("out", t("Tugagan"), out)}
        </div>
      </div>

      {list.length === 0 && !director ? (
        <div className="rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
          <EmptyBlock icon={<Gift className="size-5" strokeWidth={1.75} />} title={items.length ? t("Mos sovg'a topilmadi") : t("Hozircha sovg'a yo'q")} />
        </div>
      ) : (
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(13.5rem,1fr))]">
          {list.map(({ i, stock }) => {
            const empty = stock === 0;
            // Chegirmaning to'liq nomi («Keyingi oy to'loviga 5% chegirma») kartochkaga sig'maydi.
            const title = i.kind === "discount" ? t("To'lovga chegirma · {n}%", { n: i.discountPercent ?? 5 }) : itemTitleT(t, i);
            const menu: ActionMenuEntry[] = [
              { key: "h", heading: title },
              ...(canGive ? [{ key: "give", label: t("O'quvchiga berish"), icon: Gift, disabled: empty, title: empty ? t("Omborda qolmagan") : undefined, onSelect: () => onGive(i) } as ActionMenuEntry] : []),
              ...(director && i.kind !== "discount"
                ? [{ key: "d", divider: true } as ActionMenuEntry, { key: "del", label: t("O'chirish"), icon: Trash2, danger: true, onSelect: () => onDelete(i) } as ActionMenuEntry]
                : []),
            ];
            return (
              <article key={i.id} className="flex flex-col overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
                <div className={`flex h-[4.5rem] items-center justify-center ${empty ? "bg-v2-surface-2 text-v2-text-3" : "bg-v2-brand-bg text-v2-brand-text"}`}>
                  {i.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={i.imageUrl} alt="" className={`h-full w-full object-cover ${empty ? "opacity-50 grayscale" : ""}`} />
                  ) : (
                    <GiftIcon name={i.name} kind={i.kind} className="size-7" strokeWidth={1.5} />
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-2 p-3">
                  <div className="min-w-0">
                    <h3 className={`truncate text-v2-small font-semibold ${empty ? "text-v2-text-2" : "text-v2-text"}`} title={title}>
                      {title}
                    </h3>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <CoinValue n={i.priceCoins} className={empty ? "opacity-70" : ""} />
                      {i.kind === "discount" ? (
                        <span className="text-v2-caption text-v2-text-2">{t("keyingi oy to'loviga")}</span>
                      ) : i.kind === "service" ? (
                        <span className="text-v2-caption text-v2-text-2">{t("xizmat")}</span>
                      ) : stock === null ? null : empty ? (
                        <span className="rounded-v2-full bg-v2-surface-2 px-2 py-0.5 text-v2-caption font-medium text-v2-text-2">{t("Tugagan")}</span>
                      ) : (
                        <span className="text-v2-caption text-v2-text-2">{t("qoldiq {n} ta", { n: stock })}</span>
                      )}
                    </div>
                  </div>
                  {(director || canGive) && (
                    <div className="mt-auto flex items-center gap-2">
                      {director ? (
                        <button type="button" onClick={() => onEdit(i)} className={`${secondarySm} flex-1 justify-center`}>
                          <Pencil className="size-3.5" strokeWidth={1.75} aria-hidden />
                          {t("Tahrirlash")}
                        </button>
                      ) : (
                        <button type="button" disabled={empty} onClick={() => onGive(i)} className={`${secondarySm} flex-1 justify-center`}>
                          <Gift className="size-3.5" strokeWidth={1.75} aria-hidden />
                          {t("O'quvchiga berish")}
                        </button>
                      )}
                      {director && (
                        <ActionMenu items={menu} label={t("{name} — amallar", { name: title })} width={232}>
                          {(trigger, open) => (
                            <button
                              type="button"
                              {...trigger}
                              title={t("Amallar")}
                              aria-label={t("{name} — amallar", { name: title })}
                              className={`inline-flex size-8 shrink-0 items-center justify-center rounded-v2-md border border-v2-border-strong bg-v2-surface text-v2-text-2 transition-colors hover:bg-v2-surface-2 hover:text-v2-text focus-visible:outline-none focus-visible:shadow-v2-focus ${open ? "bg-v2-surface-2" : ""}`}
                            >
                              <MoreHorizontal className="size-4" strokeWidth={1.75} />
                            </button>
                          )}
                        </ActionMenu>
                      )}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
          {director && filter !== "out" && !needle && (
            <button
              type="button"
              onClick={onAdd}
              className="flex min-h-[12rem] flex-col items-center justify-center gap-1 rounded-v2-lg border border-dashed border-v2-border-strong bg-v2-surface px-4 text-center transition-colors hover:bg-v2-surface-2 focus-visible:outline-none focus-visible:shadow-v2-focus"
            >
              <Plus className="size-5 text-v2-brand-text" strokeWidth={2} aria-hidden />
              <span className="text-v2-small font-semibold text-v2-brand-text">{t("Sovg'a qo'shish")}</span>
              <span className="text-v2-caption text-v2-text-2">{t("nomi, narxi (tanga), qoldig'i, rasmi")}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
