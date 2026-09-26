"use client";

import "../gamification.css";
import { useCallback, useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/components/shared/Language";
import type { GamRole } from "@/lib/gamification/types";
import { gamApi } from "../api";
import { btnPrimary, cardCls } from "../ui";
import {
  AudienceChip,
  DeleteItemModal,
  DiscountModal,
  itemTitleT,
  KIND_LABEL,
  nfSom,
  ProductModal,
  Thumb,
  type ShopItemView,
} from "../shop/ShopModals";

// Sozlamalar → Gamifikatsiya → Sovg'alar (TZ 4.13, 5.7; prototipdagi
// catalogView). Katalog jadvali — rasm, nomi, toifa, turi, narx, tannarx,
// har filial ombori; qalam va savat. O'zgartirish — faqat direktor
// (server ham tekshiradi). Xuddi shu oynalar Do'kon sahifasida ham bor.

interface View {
  role: GamRole;
  kidsMaxGrade: number;
  branchOptions: { id: number; name: string }[];
  items: ShopItemView[];
}

const iconBtn =
  "gm-tap inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-35";

export default function GamGiftsTab() {
  const { t } = useT();
  const { showSuccess } = useToast();
  const [view, setView] = useState<View | null>(null);
  const [loadError, setLoadError] = useState("");
  const [edit, setEdit] = useState<{ item: ShopItemView | null } | null>(null);
  const [del, setDel] = useState<ShopItemView | null>(null);

  const load = useCallback(
    () =>
      gamApi<View>("/api/gamification/shop").then((res) => {
        if (!res.ok) setLoadError(res.error);
        else setView(res);
      }),
    [],
  );
  useEffect(() => {
    void load();
  }, [load]);

  if (loadError && !view) return <div className={`${cardCls} text-sm text-muted-foreground`}>{t(loadError)}</div>;
  if (!view) return <SpinnerBlock />;
  const dir = view.role === "director";
  const branches = view.branchOptions;
  const saved = (m: string) => {
    void load();
    showSuccess(m);
  };

  return (
    <div className="gm-page space-y-3">
      <div className={`${cardCls} space-y-3`}>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[15px] font-semibold">
            {t("Sovg'alar katalogi")} <span className="text-[12.5px] font-medium text-muted-foreground">· {t("{n} ta", { n: view.items.length })}</span>
          </h3>
          {dir && (
            <button type="button" className={`${btnPrimary} sm:ml-auto`} onClick={() => setEdit({ item: null })}>
              + {t("Sovg'a qo'shish")}
            </button>
          )}
        </div>
        {!dir && <p className="text-[12.5px] text-muted-foreground">{t("Katalogni faqat direktor o'zgartiradi.")}</p>}
        <div className="gm-scroll-card overflow-x-auto rounded-xl border border-border">
          <table className="gm-table">
            <thead>
              <tr>
                <th>{t("Sovg'a")}</th>
                <th>{t("Kimlar uchun")}</th>
                <th>{t("Turi")}</th>
                <th>{t("Narx")}</th>
                {dir && <th>{t("Tannarx")}</th>}
                {dir &&
                  branches.map((b) => (
                    <th key={b.id} title={b.name}>
                      {b.name}
                    </th>
                  ))}
                {dir && <th />}
              </tr>
            </thead>
            <tbody>
              {view.items.map((i) => (
                <tr key={i.id}>
                  <td data-l="" className="gm-lead">
                    <div className="flex items-center gap-2.5">
                      <Thumb imageUrl={i.imageUrl} emoji={i.emoji} size={36} />
                      <b className="text-[13px]">{itemTitleT(t, i)}</b>
                    </div>
                  </td>
                  <td data-l={t("Kimlar uchun")}>
                    <AudienceChip a={i.audience} kidsMaxGrade={view.kidsMaxGrade} />
                  </td>
                  <td data-l={t("Turi")}>{t(KIND_LABEL[i.kind])}</td>
                  <td data-l={t("Narx")}>
                    <span className="gm-coin">{i.priceCoins}</span>
                  </td>
                  {dir && <td data-l={t("Tannarx")}>{i.kind === "item" ? nfSom(i.costPriceSom ?? 0) : "—"}</td>}
                  {dir &&
                    branches.map((b) => (
                      <td key={b.id} data-l={t("Ombor · {branch}", { branch: b.name })}>
                        {i.kind === "item" ? String(i.stockAll?.[String(b.id)] ?? 0) : "—"}
                      </td>
                    ))}
                  {dir && (
                    <td data-l="" className="gm-keep">
                      <div className="flex items-center justify-end gap-1.5">
                        <button type="button" className={iconBtn} title={t("Tahrirlash")} aria-label={t("Tahrirlash")} onClick={() => setEdit({ item: i })}>
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className={iconBtn}
                          title={i.kind === "discount" ? t("Chegirmani o'chirib bo'lmaydi — narxi va foizini tahrirlang") : t("O'chirish")}
                          aria-label={t("O'chirish")}
                          disabled={i.kind === "discount"}
                          onClick={() => setDel(i)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[12px] text-muted-foreground">
          {dir
            ? t("Filial ustunlari — omboridagi soni. Katalogni Do'kon sahifasida ham tahrirlash mumkin. O'chirilgan sovg'a berilganlar tarixida qoladi va istaklar ro'yxatidan olinadi.")
            : t("Katalogni Do'kon sahifasida ham ko'rish mumkin.")}
        </p>
      </div>

      {edit && edit.item?.kind === "discount" && (
        <DiscountModal item={edit.item} kidsMaxGrade={view.kidsMaxGrade} onClose={() => setEdit(null)} onSaved={saved} />
      )}
      {edit && edit.item?.kind !== "discount" && (
        <ProductModal
          item={edit.item}
          branches={branches}
          kidsMaxGrade={view.kidsMaxGrade}
          onClose={() => setEdit(null)}
          onSaved={saved}
          onDelete={(it) => setDel(it)}
        />
      )}
      {del && (
        <DeleteItemModal
          item={del}
          onClose={() => setDel(null)}
          onDone={(m) => {
            setEdit(null);
            saved(m);
          }}
        />
      )}
    </div>
  );
}
