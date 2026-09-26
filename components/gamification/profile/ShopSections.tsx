"use client";

import { useEffect, useState } from "react";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useT } from "@/components/shared/Language";
import { gamApi } from "../api";
import { btnSm, Chip, fmtDate } from "../ui";
import { Thumb, type Audience, type ItemKind, type ReturnTarget } from "../shop/ShopModals";

// Profildagi do'kon bo'limlari (TZ 5.4, 4.18; prototipdagi wishHtml va
// purchHtml, xodim ko'rinishi): «♥ Istaklari» — tanga yetsa «Berish»;
// «🛍️ Sotib olganlari» — kim bergani, huquq bo'lsa «Qaytarish».

export interface WishItem {
  itemId: number;
  title: string;
  imageUrl: string | null;
  emoji: string;
  price: number;
  audience: Audience;
  kind: ItemKind;
  addedAt: string;
  ready: boolean;
  noStock: boolean;
}

interface OrderRow {
  id: number;
  itemName: string;
  kind: ItemKind;
  priceCoins: number;
  givenDate: string;
  givenByName: string;
  status: "given" | "returned";
  returnNote: string | null;
  returnedAt: string | null;
  canReturn: boolean;
}

interface PupilShop {
  wishlistMax: number;
  balance: number;
  canGive: boolean;
  enabled: boolean;
  wishes: WishItem[];
  orders: OrderRow[];
  spentTotal: number;
}

export default function ShopSections({
  pupilId,
  pupilName,
  reloadKey,
  onGive,
  onReturn,
}: {
  pupilId: number;
  pupilName: string;
  /** O'zgartirilsa qayta yuklanadi (profil yangilanganda). */
  reloadKey: number;
  onGive: (w: WishItem) => void;
  onReturn: (o: ReturnTarget) => void;
}) {
  const { t } = useT();
  const [d, setD] = useState<PupilShop | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    gamApi<PupilShop>(`/api/gamification/students/${pupilId}/shop`).then((res) => {
      if (!alive) return;
      if (res.ok) {
        setD(res);
        setErr("");
      } else setErr(res.error);
    });
    return () => {
      alive = false;
    };
  }, [pupilId, reloadKey]);

  if (err && !d) return <div className="rounded-xl border border-border px-4 py-3 text-[13px] text-muted-foreground">{t(err)}</div>;
  if (!d) return <SpinnerBlock />;

  return (
    <>
      <section>
        <h3 className="mb-2 flex items-center gap-2 text-[14px] font-semibold">
          ♥ {t("Istaklari")}
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[11.5px] font-semibold text-muted-foreground">
            {d.wishes.length}/{d.wishlistMax}
          </span>
        </h3>
        {d.wishes.length === 0 ? (
          <div className="rounded-xl border border-border px-4 py-3 text-[13px] text-muted-foreground">{t("O'quvchi hali istak qo'shmagan.")}</div>
        ) : (
          <div className="space-y-2">
            {d.wishes.map((w) => {
              const pct = Math.min(100, Math.round((d.balance / Math.max(1, w.price)) * 100));
              return (
                <div key={w.itemId} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5">
                  <Thumb imageUrl={w.imageUrl} emoji={w.emoji} size={44} />
                  <div className="min-w-0 flex-1">
                    <b className="text-[13.5px]">{t(w.title)}</b>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
                      <span className="gm-coin">
                        {d.balance} / {w.price}
                      </span>
                      {w.ready ? (
                        <span className="gm-pos">✓ {t("Tanga yetadi")}</span>
                      ) : (
                        <span className="text-muted-foreground">{t("yana {n} tanga kerak", { n: w.price - d.balance })}</span>
                      )}
                      {w.noStock && <Chip tone="r">{t("omborda yo'q")}</Chip>}
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                      <i className={`block h-full rounded-full ${w.ready ? "bg-emerald-500" : "bg-amber-400"}`} style={{ width: `${pct}%` }} />
                    </div>
                    {w.addedAt && <div className="mt-1 text-[11.5px] text-muted-foreground">{t("{date} da qo'shilgan", { date: fmtDate(w.addedAt) })}</div>}
                  </div>
                  {d.canGive && (
                    <button
                      type="button"
                      className={btnSm}
                      disabled={!w.ready}
                      onClick={() => onGive(w)}
                    >
                      {t("Berish")}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h3 className="flex items-center gap-2 text-[14px] font-semibold">
            🛍️ {t("Sotib olganlari")}
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[11.5px] font-semibold text-muted-foreground">{d.orders.length}</span>
          </h3>
          {d.orders.length > 0 && (
            <span className="ml-auto text-[12px] text-muted-foreground">
              {t("jami sarflangan:")} <b className="gm-coin">{d.spentTotal}</b>
            </span>
          )}
        </div>
        {d.orders.length === 0 ? (
          <div className="rounded-xl border border-border px-4 py-3 text-[13px] text-muted-foreground">{t("Hali do'kondan hech narsa olinmagan.")}</div>
        ) : (
          <div className="gm-scroll-card overflow-x-auto rounded-2xl border border-border">
            <table className="gm-table">
              <thead>
                <tr>
                  <th>{t("Sana")}</th>
                  <th>{t("Sovg'a")}</th>
                  <th>{t("Tanga")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {d.orders.map((o) => {
                  const cx = o.status === "returned";
                  return (
                    <tr key={o.id} className={cx ? "gm-cx" : ""}>
                      <td data-l={t("Sana")} className="whitespace-nowrap">
                        {fmtDate(o.givenDate)}
                      </td>
                      <td data-l={t("Sovg'a")}>
                        <span className="text-[13px] font-medium">{t(o.itemName)}</span>
                        <div className="text-[12px] text-muted-foreground">{t(o.givenByName)}</div>
                        {cx && (
                          <div className="gm-neg text-[12px]">
                            {t("Qaytarildi: {note} · {date}", { note: t(o.returnNote ?? ""), date: o.returnedAt ? fmtDate(o.returnedAt) : "" })}
                          </div>
                        )}
                      </td>
                      <td data-l={t("Tanga")}>{cx ? <span className="gm-strike">−{o.priceCoins}</span> : <span className="gm-neg">−{o.priceCoins}</span>}</td>
                      <td data-l="" className="gm-keep">
                        {o.canReturn && d.enabled && (
                          <button
                            type="button"
                            className={btnSm}
                            onClick={() => onReturn({ id: o.id, pupilName, itemName: o.itemName, priceCoins: o.priceCoins, givenDate: o.givenDate, kind: o.kind })}
                          >
                            {t("Qaytarish")}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
