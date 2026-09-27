"use client";

import "../gamification.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { SpinnerBlock } from "@/components/ui/Spinner";
import Select from "@/components/ui/Select";
import Link from "@/components/ui/Link";
import { useLang, useT } from "@/components/shared/Language";
import { MONTHS } from "@/lib/i18n";
import type { GamRole } from "@/lib/gamification/types";
import { gamApi } from "../api";
import { btnPrimary, btnSm, cardCls, Chip, fmtDate, useGamToast, withReward } from "../ui";
import {
  AudienceChip,
  DeleteItemModal,
  DiscountModal,
  GiveModal,
  itemTitleT,
  nfSom,
  ProductModal,
  ReturnModal,
  Thumb,
  type ReturnTarget,
  type ShopItemView,
} from "./ShopModals";

// Gamifikatsiya → Do'kon (TZ 4.13–4.18, 5.5; xodimlar ko'rinishi).
// Admin va direktor: ombor, «♥ N», «Berish», byudjet, istaklar va
// berilganlar; direktor: tannarx, katalogni tahrirlash. Ustoz — faqat
// katalog (nomi, narxi, toifasi).

interface View {
  enabled: boolean;
  role: GamRole;
  month: string;
  kidsMaxGrade: number;
  branchOptions: { id: number; name: string }[];
  items: ShopItemView[];
  budget: { branchId: number; name: string; spent: number; limit: number | null; left: number | null }[];
  wishRows: { itemId: number; title: string; price: number; wanted: number; ready: { pupilId: number; name: string; balance: number }[]; stock: number | null }[];
  discounts: {
    id: number;
    month: string;
    pupilId: number;
    pupilName: string;
    groupLabel: string;
    teacherName: string;
    monthlyPriceSom: number;
    amountSom: number;
    percent: number;
    status: "active" | "applied";
    appliedAt: string | null;
  }[];
  orders: {
    id: number;
    pupilId: number;
    pupilName: string;
    itemName: string;
    kind: "item" | "service" | "discount";
    priceCoins: number;
    branchName: string;
    costPriceSom: number | null;
    givenDate: string;
    status: "given" | "returned";
    canReturn: boolean;
  }[];
}

const PAGE = "gm-page container mx-auto max-w-[1900px] space-y-4 p-4 md:p-5";
const iconBtn =
  "gm-tap inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-35";

export default function ShopPage() {
  const { t } = useT();
  const [lang] = useLang();
  const [toastNode, toast] = useGamToast();
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState("");
  const [aud, setAud] = useState<"all" | "kids" | "older">("all");
  const [branch, setBranch] = useState("");
  const [give, setGive] = useState<{ item: ShopItemView; pupilId?: number } | null>(null);
  const [ret, setRet] = useState<ReturnTarget | null>(null);
  const [edit, setEdit] = useState<{ item: ShopItemView | null } | null>(null);
  const [del, setDel] = useState<ShopItemView | null>(null);

  const load = useCallback(
    (b: string) =>
      gamApi<View>(b ? `/api/gamification/shop?branchId=${b}` : "/api/gamification/shop").then((res) => {
        if (!res.ok) setError(res.error);
        else {
          setError("");
          setView(res);
        }
      }),
    [],
  );
  useEffect(() => {
    void load("");
  }, [load]);

  const items = useMemo(
    () => (view?.items ?? []).filter((i) => aud === "all" || i.audience === "all" || i.audience === aud),
    [view, aud],
  );
  const monthName = (m: string) => (MONTHS[lang] ?? MONTHS.uz)[Number(m.slice(5, 7)) - 1] ?? m;

  if (error && !view) {
    return (
      <div className={PAGE}>
        <h1 className="text-xl font-semibold">{t("Do'kon")}</h1>
        <div className={`${cardCls} text-sm text-muted-foreground`}>{t(error)}</div>
      </div>
    );
  }
  if (!view) return <div className={PAGE}><SpinnerBlock /></div>;
  const dir = view.role === "director";
  const adm = dir || view.role === "branch_admin";
  const branchesForForm = view.branchOptions.length ? view.branchOptions : view.budget.map((b) => ({ id: b.branchId, name: b.name }));
  const branchId = branch ? Number(branch) : null;

  const stockText = (i: ShopItemView) => {
    if (!adm || i.kind === "discount") return null;
    if (i.kind !== "item") return <span className="text-[12px] text-muted-foreground">{t("Xizmat — ombor kerak emas")}</span>;
    const entries = Object.entries(i.stock ?? {});
    const total = entries.reduce((a, [, n]) => a + n, 0);
    const bn = (id: string) => branchesForForm.find((b) => String(b.id) === id)?.name ?? `#${id}`;
    return (
      <span className="text-[12px] text-muted-foreground">
        {t("Omborda: {n} ta", { n: total })}
        {entries.length > 1 && <> — {entries.map(([b, n]) => `${bn(b)} ${n}`).join(" · ")}</>}
        {dir && i.costPriceSom ? <> · {t("tannarx {sum}", { sum: nfSom(i.costPriceSom) })}</> : null}
      </span>
    );
  };

  return (
    <div className={PAGE}>
      {toastNode}
      <div>
        <h1 className="text-xl font-semibold">{t("Do'kon")}</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {t("O'quvchilar tangani sovg'aga almashtiradi, sovg'ani filial admini beradi. Kichiklar (1–{n}-sinf) va kattalar uchun sovg'alar alohida.", {
            n: view.kidsMaxGrade,
          })}
        </p>
      </div>
      {!view.enabled && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-[13px]">
          {t("Gamifikatsiya moduli o'chiq — tangalar yozilmaydi, sahifa faqat ko'rish uchun.")}
        </div>
      )}

      <div className={cardCls}>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex h-10 items-center gap-0.5 rounded-lg border border-border bg-card p-0.5 text-[13px]" role="tablist">
            {(["all", "kids", "older"] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={aud === k}
                onClick={() => setAud(k)}
                className={`h-9 rounded-md px-3 ${aud === k ? "bg-primary text-white" : "text-muted-foreground hover:bg-secondary"}`}
              >
                {k === "all" ? t("Hammasi") : k === "kids" ? t("Kichiklar") : t("Kattalar")}
              </button>
            ))}
          </div>
          {dir && view.branchOptions.length > 1 && (
            <div className="w-full sm:w-64">
              <Select
                value={branch}
                onChange={(v) => {
                  setBranch(v);
                  void load(v);
                }}
                options={view.branchOptions.map((b) => ({ value: String(b.id), label: b.name }))}
                placeholder={t("Barcha filiallar")}
                clearable
                size="md"
              />
            </div>
          )}
          <span className="text-[12.5px] text-muted-foreground">{t("{n} ta sovg'a", { n: items.length })}</span>
          {dir && (
            <button type="button" className={`${btnPrimary} sm:ml-auto`} onClick={() => setEdit({ item: null })}>
              + {t("Sovg'a qo'shish")}
            </button>
          )}
        </div>
      </div>

      {adm && view.budget.length > 0 && (
        <div className={`${cardCls} space-y-2`}>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[15px] font-semibold">{t("{month} · sovg'a byudjeti", { month: monthName(view.month) })}</h2>
            {dir && (
              <Link href="/settings-gamification?tab=branches" className="ml-auto text-[12.5px] font-semibold text-primary hover:underline">
                {t("Byudjetni sozlash →")}
              </Link>
            )}
          </div>
          <div className="gm-scroll-card table-box rounded-xl border border-border">
            <table className="gm-table">
              <thead>
                <tr>
                  <th>{t("Filial")}</th>
                  <th>{t("Sarflangan")}</th>
                  <th>{t("Oylik byudjet")}</th>
                  <th>{t("Qoldiq")}</th>
                </tr>
              </thead>
              <tbody>
                {view.budget.map((b) => (
                  <tr key={b.branchId}>
                    <td data-l="" className="gm-lead font-semibold">
                      {b.name}
                    </td>
                    <td data-l={t("Sarflangan")}>{nfSom(b.spent)}</td>
                    <td data-l={t("Oylik byudjet")}>{b.limit === null ? <Chip tone="a">{t("Cheklanmagan")}</Chip> : nfSom(b.limit)}</td>
                    <td data-l={t("Qoldiq")}>{b.left === null ? "—" : <span className={b.left < 0 ? "gm-neg" : ""}>{nfSom(b.left)}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[12px] text-muted-foreground">{t("Faqat buyumlar tannarxi hisoblanadi (xizmat va chegirma kirmaydi). Byudjet tugasa buyum berilmaydi.")}</p>
        </div>
      )}

      {items.length === 0 ? (
        <div className={`${cardCls} text-sm text-muted-foreground`}>{t("Bu toifada sovg'a yo'q.")}</div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {items.map((i) => (
            <div key={i.id} className={`${cardCls} flex flex-col gap-2`}>
              <div className="flex items-start gap-3">
                <Thumb imageUrl={i.imageUrl} emoji={i.emoji} size={64} />
                <div className="min-w-0 flex-1">
                  <b className="block text-[14px] leading-snug">{itemTitleT(t, i)}</b>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <AudienceChip a={i.audience} kidsMaxGrade={view.kidsMaxGrade} />
                    {i.kind === "discount" ? <Chip tone="g">{t("Oyiga 1 marta")}</Chip> : i.kind === "service" ? <Chip tone="m">{t("Xizmat")}</Chip> : null}
                    {adm && i.wished > 0 && (
                      <span title={t("Istaklar ro'yxatiga qo'shgan o'quvchilar")}>
                        <Chip tone="r">♥ {i.wished}</Chip>
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {stockText(i)}
              {i.kind === "discount" && (
                <span className="text-[12px] text-muted-foreground">
                  {t("Kurs to'lovidan {n}%, Moliyada avtomatik; ustoz foizi to'liq narxdan hisoblanadi.", { n: i.discountPercent ?? 5 })}
                </span>
              )}
              <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                <span className="gm-coin text-[16px]">{i.priceCoins}</span>
                <div className="flex items-center gap-1.5">
                  {dir && (
                    <button type="button" className={iconBtn} title={t("Tahrirlash")} aria-label={t("Tahrirlash")} onClick={() => setEdit({ item: i })}>
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                  {dir && (
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
                  )}
                  {adm && (
                    <button
                      type="button"
                      className={btnSm}
                      disabled={!view.enabled}
                      onClick={() => setGive({ item: i })}
                    >
                      {t("Berish")}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {adm && (
        <div className={`${cardCls} space-y-2`}>
          <h2 className="text-[15px] font-semibold">♥ {t("O'quvchilar istaklari")}</h2>
          <p className="text-[12.5px] text-muted-foreground">
            {t("Qaysi sovg'a ko'p so'ralayotgani — omborni to'ldirish va byudjetni rejalashtirish uchun. «Tanga yetadiganlar» ismini bossangiz, berish oynasi shu o'quvchi bilan ochiladi.")}
          </p>
          {view.wishRows.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">{t("Hali hech kim istak qo'shmagan.")}</p>
          ) : (
            <div className="gm-scroll-card table-box rounded-xl border border-border">
              <table className="gm-table">
                <thead>
                  <tr>
                    <th>{t("Sovg'a")}</th>
                    <th>{t("Narx")}</th>
                    <th>{t("Istaydi")}</th>
                    <th>{t("Tanga yetadiganlar")}</th>
                    <th>{t("Omborda")}</th>
                  </tr>
                </thead>
                <tbody>
                  {view.wishRows.map((r) => {
                    const it = view.items.find((x) => x.id === r.itemId);
                    return (
                      <tr key={r.itemId}>
                        <td data-l="" className="gm-lead font-semibold">
                          {t(r.title)}
                        </td>
                        <td data-l={t("Narx")}>
                          <span className="gm-coin">{r.price}</span>
                        </td>
                        <td data-l={t("Istaydi")}>
                          <b>{r.wanted}</b>
                        </td>
                        <td data-l={t("Tanga yetadiganlar")}>
                          {r.ready.length ? (
                            <div className="flex flex-wrap justify-end gap-1 sm:justify-start">
                              {r.ready.map((p) => (
                                <button
                                  key={p.pupilId}
                                  type="button"
                                  className={btnSm}
                                  disabled={!it || !view.enabled}
                                  onClick={() => it && setGive({ item: it, pupilId: p.pupilId })}
                                >
                                  {p.name} · {p.balance}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[12px] text-muted-foreground">{t("hali hech kim")}</span>
                          )}
                        </td>
                        <td data-l={t("Omborda")}>{r.stock === null ? "—" : t("{n} ta", { n: r.stock })}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* To'lovga chegirmalar (TZ 5.5; prototipdagi discTable): shu va keyingi
          oy to'lovlariga — Moliyada avtomatik qo'llanadi, ustoz foizi to'liq
          narxdan. Oy bo'yicha alohida karta; bo'sh oy ko'rsatilmaydi. */}
      {adm &&
        [...new Set(view.discounts.map((d) => d.month))].map((m) => {
          const rows = view.discounts.filter((d) => d.month === m);
          return (
            <div key={m} className={`${cardCls} space-y-2`}>
              <h2 className="text-[15px] font-semibold">
                {t("{month} to'lovlariga chegirmalar", { month: monthName(m) })}{" "}
                <span className="text-[12.5px] font-medium text-muted-foreground">· {t("Moliyaga avtomatik")}</span>
              </h2>
              <div className="gm-scroll-card table-box rounded-xl border border-border">
                <table className="gm-table">
                  <thead>
                    <tr>
                      <th>{t("O'quvchi")}</th>
                      <th>{t("Kurs")}</th>
                      <th>{t("Oylik narx")}</th>
                      <th>{t("Chegirma")}</th>
                      <th>{t("To'lanadi")}</th>
                      <th>{t("Ustoz foizi")}</th>
                      <th>{t("Holat")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((d) => (
                      <tr key={d.id}>
                        <td data-l="" className="gm-lead font-semibold">
                          {d.pupilName}
                        </td>
                        <td data-l={t("Kurs")}>{d.groupLabel}</td>
                        <td data-l={t("Oylik narx")}>{nfSom(d.monthlyPriceSom)}</td>
                        <td data-l={t("Chegirma")}>
                          <span className="gm-neg">
                            −{nfSom(d.amountSom)} ({d.percent}%)
                          </span>
                        </td>
                        <td data-l={t("To'lanadi")}>{nfSom(d.monthlyPriceSom - d.amountSom)}</td>
                        <td data-l={t("Ustoz foizi")}>
                          <span className="text-[12px]">{t("to'liq narxdan ({sum})", { sum: nfSom(d.monthlyPriceSom) })}</span>
                        </td>
                        <td data-l={t("Holat")}>
                          {d.status === "applied" ? (
                            <Chip tone="g">{d.appliedAt ? t("Qo'llandi · {date}", { date: fmtDate(d.appliedAt) }) : t("Qo'llandi")}</Chip>
                          ) : (
                            <Chip tone="a">{t("To'lov kutilmoqda")}</Chip>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}

      {adm && (
        <div className={`${cardCls} space-y-2`}>
          <h2 className="text-[15px] font-semibold">{t("{month}da berilganlar", { month: monthName(view.month) })}</h2>
          {view.orders.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">{t("Bu oyda hali sovg'a berilmagan.")}</p>
          ) : (
            <div className="gm-scroll-card table-box rounded-xl border border-border">
              <table className="gm-table">
                <thead>
                  <tr>
                    <th>{t("Sana")}</th>
                    <th>{t("O'quvchi")}</th>
                    <th>{t("Sovg'a")}</th>
                    <th>{t("Tanga")}</th>
                    <th>{t("Filial")}</th>
                    {dir && <th>{t("Tannarx")}</th>}
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {view.orders.map((o) => {
                    const cx = o.status === "returned";
                    return (
                      <tr key={o.id} className={cx ? "gm-cx" : ""}>
                        <td data-l={t("Sana")} className="whitespace-nowrap">
                          {fmtDate(o.givenDate)}
                        </td>
                        <td data-l="" className="gm-lead font-semibold">
                          {o.pupilName}
                        </td>
                        <td data-l={t("Sovg'a")}>{t(o.itemName)}</td>
                        <td data-l={t("Tanga")}>{cx ? <span className="gm-strike">−{o.priceCoins}</span> : <span className="gm-neg">−{o.priceCoins}</span>}</td>
                        <td data-l={t("Filial")} className="text-[12.5px]">
                          {o.branchName}
                        </td>
                        {dir && <td data-l={t("Tannarx")}>{o.costPriceSom ? nfSom(o.costPriceSom) : "—"}</td>}
                        <td data-l="" className="gm-keep">
                          {cx ? (
                            <Chip tone="m">{t("Qaytarilgan")}</Chip>
                          ) : o.canReturn && view.enabled ? (
                            <button
                              type="button"
                              className={btnSm}
                              onClick={() => setRet({ id: o.id, pupilName: o.pupilName, itemName: o.itemName, priceCoins: o.priceCoins, givenDate: o.givenDate, kind: o.kind })}
                            >
                              {t("Qaytarish")}
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {give && (
        <GiveModal
          item={give.item}
          branchId={branchId}
          preselect={give.pupilId}
          onClose={() => setGive(null)}
          onDone={(r) => {
            void load(branch);
            const msg = t("{name}: «{title}» berildi, −{n} tanga", { name: r.pupilName, title: t(r.title), n: r.price });
            toast(withReward(t, r.wished ? `${msg} · ${t("istaklardan olindi")}` : msg, r.pupilName, r));
          }}
        />
      )}
      {ret && (
        <ReturnModal
          order={ret}
          onClose={() => setRet(null)}
          onDone={() => {
            void load(branch);
            toast(t("{name}: «{title}» qaytarildi, +{n} tanga", { name: ret.pupilName, title: t(ret.itemName), n: ret.priceCoins }));
          }}
        />
      )}
      {edit && edit.item?.kind === "discount" && (
        <DiscountModal item={edit.item} kidsMaxGrade={view.kidsMaxGrade} onClose={() => setEdit(null)} onSaved={(m) => { void load(branch); toast(m); }} />
      )}
      {edit && edit.item?.kind !== "discount" && (
        <ProductModal
          item={edit.item}
          branches={branchesForForm}
          kidsMaxGrade={view.kidsMaxGrade}
          onClose={() => setEdit(null)}
          onSaved={(m) => {
            void load(branch);
            toast(m);
          }}
          onDelete={(it) => setDel(it)}
        />
      )}
      {del && (
        <DeleteItemModal
          item={del}
          onClose={() => setDel(null)}
          onDone={(m) => {
            setEdit(null);
            void load(branch);
            toast(m);
          }}
        />
      )}
    </div>
  );
}
