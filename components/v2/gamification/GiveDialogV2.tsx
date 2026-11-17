"use client";

import { useEffect, useMemo, useState } from "react";
import { Gift, Heart, Loader2, Search } from "lucide-react";
import { useT } from "@/components/shared/Language";
import { gamApi } from "@/components/gamification/api";
import type { GiveDone, ShopItemView } from "@/components/gamification/shop/ShopModals";
import V2Dialog from "@/components/v2/form/V2Dialog";
import { fieldCls } from "@/components/v2/form/fields";
import { primaryBtn, secondaryBtn } from "@/components/v2/ui/buttons";
import { GiftThumb } from "./gamBits";

// «SOVG'A BERISH» (33-qism, rasm «Do'kon · Sovg'a berish»): sovg'a kartasi (turi, toifa, ombor, tannarx —
// direktorga), qidiruv va «♥ Istak qilganlar» filtri, o'quvchilar (balans, «Tanga yetadi» / «Yetmaydi ·
// 241 / 250» / server sababi), oqibat qutisi (balans, daraja, byudjet, ombor). Buyum va xizmat uchun;
// to'lovga chegirma — eski oyna (kurs tanlanadi). Server: GET /api/gamification/shop/eligible,
// POST /api/gamification/shop/orders (lib/gamification/shop.ts — hamma tekshiruv shu yerda).

interface Eligible {
  pupilId: number;
  name: string;
  grade: number | null;
  branchName: string;
  groups: string[];
  balance: number;
  wished: boolean;
  error: string | null;
}

const KIND: Record<string, string> = { item: "Buyum", service: "Xizmat", discount: "Chegirma" };
const AUD: Record<string, string> = { all: "Hammaga", kids: "Kichiklar", older: "Kattalar" };
const som = (n: number) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")}`;

export default function GiveDialogV2({
  item,
  branchId,
  branchName,
  stock,
  budgetLeft,
  preselect,
  meta,
  onClose,
  onDone,
}: {
  item: ShopItemView;
  branchId: number | null;
  branchName: string;
  /** Tanlangan ombordagi soni (buyum emas — null). */
  stock: number | null;
  /** Tanlangan filialning qolgan byudjeti (cheklanmagan — null). */
  budgetLeft: number | null;
  preselect?: number | null;
  /** Sarlavha ostidagi qator: «Akademiya 1 Chortoq · admin X · 12-oktabr | 18:40». */
  meta: string;
  onClose: () => void;
  onDone: (res: GiveDone) => void;
}) {
  const { t } = useT();
  const [rows, setRows] = useState<Eligible[] | null>(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [onlyWished, setOnlyWished] = useState(false);
  const [sel, setSel] = useState<number | null>(preselect ?? null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    const url = `/api/gamification/shop/eligible?itemId=${item.id}${branchId ? `&branchId=${branchId}` : ""}`;
    void gamApi<{ rows: Eligible[] }>(url).then((r) => {
      if (!alive) return;
      if (r.ok) setRows(r.rows);
      else setErr(r.error);
    });
    return () => {
      alive = false;
    };
  }, [item.id, branchId]);

  const wishedCount = rows?.filter((r) => r.wished).length ?? 0;
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (rows ?? []).filter((r) => (!onlyWished || r.wished) && (!s || r.name.toLowerCase().includes(s) || r.groups.some((g) => g.toLowerCase().includes(s))));
  }, [rows, q, onlyWished]);
  const LIMIT = 30;
  const visible = shown.slice(0, LIMIT);
  const hiddenWished = onlyWished ? 0 : (rows ?? []).filter((r) => r.wished && r.error && !visible.includes(r)).length;
  const cur = rows?.find((r) => r.pupilId === sel) ?? null;
  const first = cur ? cur.name.split(/\s+/)[0] : "";
  const cost = item.costPriceSom;

  async function give(close: () => void) {
    if (!cur || cur.error || saving) return;
    setSaving(true);
    const res = await gamApi<{ order: { itemName: string }; wished: boolean; levelUp: { name: string } | null; badges: { name: string }[] }>("/api/gamification/shop/orders", {
      method: "POST",
      body: { pupilId: cur.pupilId, itemId: item.id },
    });
    setSaving(false);
    if (!res.ok) {
      setErr(t(res.error));
      return;
    }
    onDone({ pupilName: cur.name, title: res.order.itemName, price: item.priceCoins, wished: res.wished, levelUp: res.levelUp, badges: res.badges ?? [] });
    close();
  }

  const metaLine = [
    t(KIND[item.kind] ?? item.kind),
    t(AUD[item.audience] ?? item.audience),
    item.kind === "item" && stock !== null ? t("{branch} omborida {n} ta", { branch: branchName, n: stock }) : "",
    cost !== null && item.kind === "item" ? t("tannarx {n} so'm", { n: som(cost) }) : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <V2Dialog
      title={t("Sovg'a berish")}
      subtitle={meta}
      onClose={onClose}
      saving={saving}
      dirty={sel !== null && sel !== (preselect ?? null)}
      width={640}
      footer={(api) => (
        <>
          <button type="button" onClick={api.requestClose} disabled={saving} className={`${secondaryBtn} max-sm:hidden`}>
            {t("Bekor qilish")}
          </button>
          <button type="button" onClick={() => void give(api.close)} disabled={!cur || !!cur.error || saving} className={`${primaryBtn} max-sm:flex-1 max-sm:justify-center disabled:opacity-50`}>
            <Gift className="size-4" strokeWidth={1.75} aria-hidden />
            {t("Sovg'ani berish · {n} tanga", { n: item.priceCoins })}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-4 rounded-v2-lg border border-v2-border bg-v2-surface-2 p-4">
          <GiftThumb name={item.name} kind={item.kind} imageUrl={item.imageUrl} size="md" />
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-v2-text">{t(item.title)}</div>
            <div className="text-v2-small text-v2-text-2">{metaLine}</div>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[24px] font-semibold tabular-nums text-v2-text">
            <span className="size-3 rounded-full bg-v2-warning" aria-hidden />
            {item.priceCoins}
          </span>
        </div>

        <div className="flex gap-2">
          <label className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-v2-text-3" strokeWidth={1.75} aria-hidden />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Ism bo'yicha qidirish")} aria-label={t("Ism bo'yicha qidirish")} className={fieldCls("default", "pl-9")} data-enter-ignore />
          </label>
          <button
            type="button"
            aria-pressed={onlyWished}
            onClick={() => setOnlyWished((v) => !v)}
            disabled={!wishedCount}
            className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-v2-md border px-3 text-v2-small font-semibold transition-colors disabled:opacity-50 ${
              onlyWished ? "border-v2-brand bg-v2-brand-bg text-v2-brand-text" : "border-v2-border-strong text-v2-text hover:bg-v2-hover"
            }`}
          >
            <Heart className={`size-4 ${onlyWished ? "fill-current" : ""}`} strokeWidth={1.75} aria-hidden />
            {t("Istak qilganlar · {n}", { n: wishedCount })}
          </button>
        </div>

        <div className="max-h-[22rem] overflow-y-auto rounded-v2-lg border border-v2-border">
          {!rows ? (
            <div className="flex items-center gap-2 px-4 py-6 text-v2-small text-v2-text-3">
              {err ? t(err) : <Loader2 className="size-4 animate-spin" aria-hidden />}
            </div>
          ) : visible.length === 0 ? (
            <p className="px-4 py-6 text-center text-v2-small text-v2-text-3">{t("O'quvchi topilmadi")}</p>
          ) : (
            <div role="radiogroup" aria-label={t("O'quvchi")}>
              {visible.map((r) => {
                const on = r.pupilId === sel;
                const short = r.balance < item.priceCoins;
                return (
                  <button
                    key={r.pupilId}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={!!r.error}
                    onClick={() => {
                      setSel(r.pupilId);
                      setErr("");
                    }}
                    className={`flex w-full items-center gap-3 border-b border-v2-border px-4 py-3 text-left last:border-b-0 disabled:cursor-not-allowed ${on ? "bg-v2-brand-bg" : "hover:bg-v2-hover"} ${r.error ? "opacity-60" : ""}`}
                  >
                    <span className={`grid size-5 shrink-0 place-items-center rounded-full border-2 ${on ? "border-v2-brand" : "border-v2-border-strong"}`} aria-hidden>
                      {on && <span className="size-2.5 rounded-full bg-v2-brand" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 font-semibold text-v2-text">
                        <span className="truncate">{r.name}</span>
                        {r.wished && <Heart className="size-3.5 shrink-0 fill-v2-danger text-v2-danger" strokeWidth={1.75} aria-label={t("istak qilgan")} />}
                      </span>
                      <span className="block truncate text-v2-small text-v2-text-2">{r.groups.length ? r.groups.join(", ") : r.branchName}</span>
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1.5 font-semibold tabular-nums text-v2-text">
                      <span className="size-2.5 rounded-full bg-v2-warning" aria-hidden />
                      {r.balance}
                    </span>
                    <span
                      className={`w-40 shrink-0 truncate rounded-full px-2.5 py-1 text-center text-v2-caption font-semibold ${
                        !r.error ? "bg-v2-success-bg text-v2-success" : short ? "bg-v2-surface-2 text-v2-text-2" : "bg-v2-warning-bg text-v2-warning"
                      }`}
                      title={r.error ? t(r.error) : undefined}
                    >
                      {!r.error ? t("Tanga yetadi") : short ? t("Yetmaydi · {b} / {p}", { b: r.balance, p: item.priceCoins }) : t(r.error)}
                    </span>
                  </button>
                );
              })}
              {(shown.length > LIMIT || hiddenWished > 0) && (
                <p className="px-4 py-2.5 text-v2-small text-v2-text-2">
                  {shown.length > LIMIT ? t("Yana {n} ta o'quvchi — qidiruvdan toping", { n: shown.length - LIMIT }) : t("Yana {n} ta istak qilgan o'quvchi — tanga yetmaydi", { n: hiddenWished })}
                </p>
              )}
            </div>
          )}
        </div>

        {err && rows && <p className="text-v2-small text-v2-danger">{err}</p>}

        {cur && !cur.error && (
          <div className="grid gap-x-6 gap-y-1.5 rounded-v2-lg bg-v2-info-bg px-4 py-3 text-v2-small text-v2-text sm:grid-cols-2">
            <span>
              {t("{name} balansi", { name: first })}: <b className="font-semibold">{cur.balance} → {cur.balance - item.priceCoins}</b>
            </span>
            <span>
              {t("Daraja")}: <b className="font-semibold">{t("o'zgarmaydi")}</b>
            </span>
            {item.kind === "item" && cost !== null && budgetLeft !== null && (
              <span>
                {t("{branch} byudjeti", { branch: branchName })}: <b className="font-semibold">{som(budgetLeft)} → {som(budgetLeft - cost)}</b>
              </span>
            )}
            {item.kind === "item" && stock !== null && (
              <span>
                {t("{branch} ombori", { branch: branchName })}: <b className="font-semibold">{stock} → {stock - 1} {t("ta")}</b>
              </span>
            )}
            <span className="sm:col-span-2 text-v2-text-2">
              {cur.wished ? `${t("Sovg'a istaklar ro'yxatidan olinadi.")} ` : ""}
              {t("O'quvchi kabinetida «Sotib olganlarim»ga tushadi.")}
            </span>
          </div>
        )}
      </div>
    </V2Dialog>
  );
}
