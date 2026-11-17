"use client";

import { Heart, Pencil, Plus } from "lucide-react";
import Link from "@/components/ui/Link";
import { useT } from "@/components/shared/Language";
import type { ShopItemView } from "@/components/gamification/shop/ShopModals";
import V2Select from "@/components/v2/ui/V2Select";
import { secondaryBtn, secondaryIcon } from "@/components/v2/ui/buttons";
import { useProfileFmt } from "@/components/v2/students/profile/profileBits";
import { GiftIcon, uzParts } from "./gamBits";
import type { ShopData } from "./shopTypes";

// DO'KON — ASOSIY KO'RINISH (33-qism, rasm «Do'kon»): oy sovg'a byudjeti (filiallar bo'yicha), toifa
// tablari (Hammasi / Kichiklar / Kattalar) va ombor; sovg'a kartalari (♥ — istak qilganlar soni, narx,
// toifa, ombor holati, «Berish», ✎); pastda «O'quvchilar istaklari» (tanga yetadiganlar — bosilsa
// berish oynasi shu o'quvchi bilan) va «Oyda berilganlar». Ma'lumot — GET /api/gamification/shop.

export type AudTab = "all" | "kids" | "older";

const KIND_LABEL: Record<string, string> = { item: "Buyum", service: "Xizmat", discount: "Chegirma" };
const AUD_LABEL: Record<string, string> = { all: "Hammaga", kids: "Kichiklar", older: "Kattalar" };
const som = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const shortName = (n: string) => {
  const [a, b] = n.split(/\s+/);
  return b ? `${a} ${b[0]}.` : a;
};
const shortBranch = (s: string) => s.replace(/^Akademiya\s+(\d+)\s+(.+?)(\s·.*)?$/i, "$2 $1").trim();

export default function ShopBoardV2({
  shop,
  branches,
  branchId,
  onBranch,
  aud,
  onAud,
  onGive,
  onEdit,
  onAdd,
}: {
  shop: ShopData;
  branches: { id: number; name: string }[];
  branchId: number | null;
  onBranch: (id: number) => void;
  aud: AudTab;
  onAud: (a: AudTab) => void;
  onGive: (item: ShopItemView, pupilId?: number) => void;
  onEdit: (item: ShopItemView) => void;
  onAdd: () => void;
}) {
  const { t } = useT();
  const fmt = useProfileFmt();
  const director = shop.role === "director";
  const adm = director || shop.role === "branch_admin";
  const branch = branches.find((b) => b.id === branchId) ?? null;
  const bName = branch ? shortBranch(branch.name) : t("Barcha omborlar");
  const monthName = fmt.monthName(shop.month);

  const stockOf = (i: ShopItemView): number | null => {
    if (i.kind !== "item") return null;
    const src = i.stockAll ?? i.stock;
    if (!src) return null;
    return branchId !== null ? Number(src[String(branchId)]) || 0 : Object.values(src).reduce((a, n) => a + (Number(n) || 0), 0);
  };
  const fits = (i: ShopItemView, a: AudTab) => a === "all" || i.audience === "all" || i.audience === a;
  const items = shop.items.filter((i) => fits(i, aud));
  const counts = { all: shop.items.length, kids: shop.items.filter((i) => fits(i, "kids")).length, older: shop.items.filter((i) => fits(i, "older")).length };
  const wishBy = new Map(shop.wishRows.map((w) => [w.itemId, w]));
  const orders = shop.orders.filter((o) => (branchId === null || o.branchId === branchId) && o.status === "given");
  const ordersCoins = orders.reduce((a, o) => a + o.priceCoins, 0);
  const ordersSom = orders.reduce((a, o) => a + (o.costPriceSom ?? 0), 0);
  const itemsGiven = (bid: number) => shop.orders.filter((o) => o.branchId === bid && o.status === "given" && o.kind === "item").length;

  return (
    <div className="flex flex-col gap-4">
      {/* Byudjet */}
      {adm && shop.budget.length > 0 && (
        <section className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-v2-border px-5 py-3.5">
            <h2 className="text-v2-h3 font-semibold text-v2-text">
              {monthName} · {t("sovg'a byudjeti")}
            </h2>
            <span className="text-v2-small text-v2-text-2">{t("faqat buyum tannarxi hisoblanadi — xizmat va chegirma kirmaydi · byudjet tugasa buyum berilmaydi")}</span>
            {director && (
              <Link href="/settings-gamification?tab=branches" className="ml-auto text-v2-small font-semibold text-v2-brand hover:underline">
                {t("Byudjetni sozlash")} →
              </Link>
            )}
          </div>
          <div className="grid sm:grid-cols-2 xl:grid-cols-4">
            {shop.budget.map((b) => {
              const pct = b.limit ? Math.min(100, (b.spent / b.limit) * 100) : 0;
              return (
                <div key={b.branchId} className="border-b border-v2-border p-5 sm:border-r xl:border-b-0 [&:nth-child(4n)]:border-r-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold text-v2-text">{b.name}</span>
                    {b.limit === null && <span className="shrink-0 rounded-full bg-v2-warning-bg px-2 py-0.5 text-v2-caption font-semibold text-v2-warning">{t("Cheklanmagan")}</span>}
                  </div>
                  <div className="mt-2 text-v2-small text-v2-text-2">
                    <b className="text-[22px] font-semibold tabular-nums text-v2-text">{som(b.spent)}</b>
                    {b.limit !== null ? ` / ${som(b.limit)} ${t("so'm")}` : ` ${t("so'm")}`}
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-v2-surface-2">
                    <div className={`h-full rounded-full ${pct >= 90 ? "bg-v2-danger" : "bg-v2-brand"}`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-2 text-v2-small text-v2-text-2">
                    {b.limit === null ? t("chegara qo'yilmagan — sozlashni tavsiya qilamiz") : t("qoldi {left} so'm · {n} ta buyum", { left: som(Math.max(0, b.left ?? 0)), n: itemsGiven(b.branchId) })}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Toifa va ombor */}
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label={t("Toifa")} className="flex gap-1 rounded-v2-md border border-v2-border bg-v2-surface-2 p-1">
          {(["all", "kids", "older"] as const).map((k) => {
            const on = aud === k;
            return (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => onAud(k)}
                className={`h-9 rounded-[6px] px-3.5 text-v2-small transition-colors ${on ? "border border-v2-border bg-v2-surface font-semibold text-v2-text shadow-v2-sm" : "border border-transparent text-v2-text-2 hover:text-v2-text"}`}
              >
                {k === "all" ? t("Hammasi") : k === "kids" ? t("Kichiklar") : t("Kattalar")} <span className="tabular-nums text-v2-text-3">{counts[k]}</span>
              </button>
            );
          })}
        </div>
        {adm && branches.length > 1 && (
          <div className="w-72">
            <V2Select variant="value" label={t("Ombor")} value={branchId !== null ? String(branchId) : ""} onChange={(v) => onBranch(Number(v))} options={branches.map((b) => ({ value: String(b.id), label: b.name }))} />
          </div>
        )}
        {adm && branches.length === 1 && (
          <span className="inline-flex h-10 items-center rounded-v2-md border border-v2-border px-3 text-v2-small text-v2-text-2">
            {t("Ombor")}: <b className="ml-1 font-semibold text-v2-text">{branches[0].name}</b>
          </span>
        )}
        <span className="ml-auto inline-flex items-center gap-1.5 text-v2-small text-v2-text-2">
          <Heart className="size-3.5 fill-v2-danger text-v2-danger" strokeWidth={1.75} aria-hidden /> — {t("o'quvchilar istak qilgan soni")}
        </span>
      </div>

      {/* Kartalar */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-3">
        {items.map((i) => {
          const st = stockOf(i);
          const out = i.kind === "item" && st !== null && st <= 0;
          const low = i.kind === "item" && st !== null && st > 0 && st <= 3;
          const waiting = wishBy.get(i.id)?.wanted ?? i.wished;
          const band = out ? "bg-v2-surface-2 text-v2-text-3" : i.kind === "discount" ? "bg-v2-violet-bg text-v2-violet" : "bg-v2-brand-bg text-v2-brand";
          const stockLine =
            i.kind === "service"
              ? t("Ombor kerak emas")
              : i.kind === "discount"
                ? t("Oyiga 1 marta · Moliyada o'zi")
                : st === null
                  ? ""
                  : out
                    ? waiting > 0
                      ? t("Tugagan · {n} kishi kutmoqda", { n: waiting })
                      : t("Tugagan")
                    : t("{branch} omborida {n} ta", { branch: bName, n: st });
          return (
            <article key={i.id} className="flex flex-col overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
              <div className={`relative flex h-24 items-center justify-center ${band}`}>
                <span className={`absolute left-3 top-3 rounded-v2-sm bg-v2-surface px-2 py-0.5 text-v2-caption font-semibold ${i.kind === "discount" ? "text-v2-violet" : i.kind === "service" ? "text-v2-info" : "text-v2-text-2"}`}>
                  {t(KIND_LABEL[i.kind])}
                </span>
                {i.wished > 0 && (
                  <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-v2-surface px-2 py-0.5 text-v2-caption font-semibold text-v2-danger">
                    <Heart className="size-3 fill-current" strokeWidth={1.75} aria-hidden />
                    {i.wished}
                  </span>
                )}
                <GiftIcon name={i.name} kind={i.kind} className="size-9" />
              </div>
              <div className="flex flex-1 flex-col p-4">
                <h3 className={`min-h-[2.75rem] text-v2-body font-semibold leading-snug ${out ? "text-v2-text-2" : "text-v2-text"}`}>{t(i.title)}</h3>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[20px] font-semibold tabular-nums text-v2-text">
                    <span className="size-3 rounded-full bg-v2-warning" aria-hidden />
                    {i.priceCoins}
                  </span>
                  <span className="rounded-v2-sm bg-v2-surface-2 px-2 py-0.5 text-v2-caption font-semibold text-v2-text-2">{t(AUD_LABEL[i.audience])}</span>
                </div>
                <p className={`mt-1.5 min-h-5 text-v2-small ${out ? "font-semibold text-v2-danger" : low ? "font-semibold text-v2-warning" : "text-v2-text-2"}`}>{stockLine}</p>
                <div className="mt-3 flex gap-2">
                  <button type="button" disabled={!adm || out || !shop.enabled} onClick={() => onGive(i)} className={`${secondaryBtn} flex-1 justify-center disabled:opacity-50`}>
                    {t("Berish")}
                  </button>
                  {director && (
                    <button type="button" onClick={() => onEdit(i)} aria-label={t("Tahrirlash")} title={t("Tahrirlash")} className={secondaryIcon}>
                      <Pencil className="size-4" strokeWidth={1.75} />
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
        {director && (
          <button type="button" onClick={onAdd} className="flex min-h-[18rem] flex-col items-center justify-center gap-2 rounded-v2-lg border border-dashed border-v2-border-strong text-v2-small font-semibold text-v2-text-2 hover:bg-v2-hover">
            <Plus className="size-5" strokeWidth={1.75} aria-hidden />
            {t("Sovg'a qo'shish")}
          </button>
        )}
      </div>

      {/* Istaklar va berilganlar */}
      {adm && (
        <div className="grid items-start gap-4 xl:grid-cols-2">
          <section className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
            <div className="border-b border-v2-border px-5 py-4">
              <h2 className="text-v2-h3 font-semibold text-v2-text">{t("O'quvchilar istaklari")}</h2>
              <p className="mt-0.5 text-v2-small text-v2-text-2">{t("Omborni to'ldirish va byudjetni rejalash uchun · ismni bossangiz, berish oynasi shu o'quvchi bilan ochiladi")}</p>
            </div>
            {shop.wishRows.length === 0 ? (
              <p className="px-5 py-6 text-v2-small text-v2-text-3">{t("Hali istak yo'q — o'quvchilar kabinetda sovg'aga ♥ bosadi")}</p>
            ) : (
              shop.wishRows.map((w) => {
                const it = shop.items.find((x) => x.id === w.itemId);
                const st = it ? stockOf(it) : null;
                const right = it?.kind === "service" ? t("xizmat") : it?.kind === "discount" ? t("chegirma") : st !== null && st <= 0 ? t("Tugagan") : st !== null ? t("{n} ta bor", { n: st }) : "";
                return (
                  <div key={w.itemId} className="grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)_auto] gap-3 border-b border-v2-border px-5 py-3 last:border-b-0">
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-v2-text">{t(w.title)}</div>
                      <div className="text-v2-small text-v2-text-2">
                        <span className="mr-1 inline-block size-2 rounded-full bg-v2-warning" aria-hidden />
                        {w.price} · {t("{n} ta istak", { n: w.wanted })}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-v2-small text-v2-text-2">{t("Tanga yetadi")}:</span>
                      {w.ready.length === 0 ? (
                        <span className="text-v2-small text-v2-text-3">—</span>
                      ) : (
                        w.ready.map((p) => (
                          <button
                            key={p.pupilId}
                            type="button"
                            disabled={!it || (st !== null && st <= 0)}
                            onClick={() => it && onGive(it, p.pupilId)}
                            className="rounded-v2-sm bg-v2-success-bg px-2 py-0.5 text-v2-small font-semibold text-v2-success hover:brightness-95 disabled:opacity-60"
                            title={t("{name} — balans {n}", { name: p.name, n: p.balance })}
                          >
                            {shortName(p.name)}
                          </button>
                        ))
                      )}
                    </div>
                    <span className={`text-right text-v2-small font-semibold ${st !== null && st <= 0 ? "text-v2-danger" : st !== null && st <= 3 ? "text-v2-warning" : "text-v2-text-2"}`}>{right}</span>
                  </div>
                );
              })
            )}
          </section>

          <section className="overflow-hidden rounded-v2-lg border border-v2-border bg-v2-surface shadow-v2-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-v2-border px-5 py-4">
              <h2 className="text-v2-h3 font-semibold text-v2-text">
                {t("{month}da berilganlar", { month: monthName })} <span className="font-normal text-v2-text-2">· {bName}</span>
              </h2>
              <span className="text-v2-small text-v2-text-2">
                {t("{n} ta", { n: orders.length })} · {t("{n} tanga", { n: ordersCoins })}
                {director ? ` · ${som(ordersSom)} ${t("so'm")}` : ""}
              </span>
            </div>
            {orders.length === 0 ? (
              <p className="px-5 py-6 text-v2-small text-v2-text-3">{t("Bu oyda sovg'a berilmagan")}</p>
            ) : (
              orders.map((o) => {
                const at = uzParts(o.givenAt);
                return (
                  <div key={o.id} className="flex items-start gap-3 border-b border-v2-border px-5 py-3 last:border-b-0">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-v2-body">
                        <b className="font-semibold text-v2-text">{o.pupilName}</b> <span className="text-v2-text-2">· {t(o.itemName)}</span>
                      </div>
                      <div className="text-v2-small text-v2-text-2">
                        {fmt.dayMonth(o.givenDate)}
                        {at.hm ? ` | ${at.hm}` : ""} · {t("berdi {name}", { name: o.givenByName })}
                      </div>
                    </div>
                    <div className="text-right">
                      <b className="block font-semibold tabular-nums text-v2-text">−{o.priceCoins}</b>
                      {o.costPriceSom !== null && <span className="text-v2-small tabular-nums text-v2-text-2">{som(o.costPriceSom)} {t("so'm")}</span>}
                    </div>
                  </div>
                );
              })
            )}
          </section>
        </div>
      )}
    </div>
  );
}
