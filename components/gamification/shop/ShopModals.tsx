"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Modal, { useModalClose } from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import { SpinnerBlock } from "@/components/ui/Spinner";
import { useT } from "@/components/shared/Language";
import { intIn } from "@/lib/gamification/rules";
import { gamApi } from "../api";
import { btnDanger, btnGhost, btnPrimary, btnSm, Chip, FieldError, fmtDate, inputCls } from "../ui";

// Do'kon oynalari (TZ 4.13–4.15; prototipdagi giveModal, returnModal,
// prodModal, delModal). Hammasi forma oynasi — Esc va fon bilan
// yopilmaydi (TZ 5.0). Server hamma tekshiruvni o'zi takrorlaydi.

export type Audience = "all" | "kids" | "older";
export type ItemKind = "item" | "service" | "discount";

export interface ShopItemView {
  id: number;
  title: string;
  name: string;
  imageUrl: string | null;
  emoji: string;
  priceCoins: number;
  audience: Audience;
  kind: ItemKind;
  discountPercent: number | null;
  stock: Record<string, number> | null;
  stockAll: Record<string, number> | null;
  costPriceSom: number | null;
  wished: number;
}

export const nfSom = (n: number) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} so'm`;

type TFn = (k: string, p?: Record<string, string | number>) => string;

/** Sovg'a nomi; chegirmaniki tilga qarab (TZ 6.8). */
export function itemTitleT(t: TFn, i: { kind: ItemKind; name: string; title: string; discountPercent: number | null }): string {
  return i.kind === "discount" ? t("Keyingi oy to'loviga {n}% chegirma", { n: i.discountPercent ?? 5 }) : t(i.title);
}

export const KIND_LABEL: Record<ItemKind, string> = { item: "Buyum", service: "Xizmat", discount: "To'lovga chegirma" };

export function Thumb({ imageUrl, emoji, size = 56 }: { imageUrl: string | null; emoji: string; size?: number }) {
  return imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={imageUrl} alt="" className="shrink-0 rounded-xl object-cover" style={{ width: size, height: size }} />
  ) : (
    <div className="flex shrink-0 items-center justify-center rounded-xl bg-secondary" style={{ width: size, height: size, fontSize: size * 0.5 }}>
      {emoji || "🎁"}
    </div>
  );
}

export function AudienceChip({ a, kidsMaxGrade }: { a: Audience; kidsMaxGrade: number }) {
  const { t } = useT();
  return a === "kids" ? (
    <Chip tone="b">{t("Kichiklar (1–{n}-sinf)", { n: kidsMaxGrade })}</Chip>
  ) : a === "older" ? (
    <Chip tone="m">{t("Kattalar")}</Chip>
  ) : (
    <Chip tone="g">{t("Hammaga")}</Chip>
  );
}

// ── Sovg'a berish ──────────────────────────────────────────────────────

interface Eligible {
  pupilId: number;
  name: string;
  grade: number | null;
  branchName: string;
  balance: number;
  wished: boolean;
  error: string | null;
}

export interface GiveDone {
  pupilName: string;
  title: string;
  price: number;
  wished: boolean;
  levelUp: { name: string } | null;
  badges: { name: string }[];
}

export function GiveModal({
  item,
  branchId,
  preselect,
  onClose,
  onDone,
}: {
  item: Pick<ShopItemView, "id" | "title" | "priceCoins" | "audience" | "kind" | "imageUrl" | "emoji">;
  branchId: number | null;
  preselect?: number | null;
  onClose: () => void;
  onDone: (res: GiveDone) => void;
}) {
  const { t } = useT();
  const modal = useModalClose(onClose);
  const [rows, setRows] = useState<Eligible[] | null>(null);
  const [kidsMaxGrade, setKidsMaxGrade] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<number | null>(preselect ?? null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    const url = branchId ? `/api/gamification/shop/eligible?itemId=${item.id}&branchId=${branchId}` : `/api/gamification/shop/eligible?itemId=${item.id}`;
    gamApi<{ rows: Eligible[]; kidsMaxGrade: number }>(url).then((res) => {
      if (!alive) return;
      if (res.ok) {
        setRows(res.rows);
        setKidsMaxGrade(res.kidsMaxGrade);
        // Profildan ochilganda tanlangan o'quvchi ko'rinib tursin.
        requestAnimationFrame(() => listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" }));
      } else {
        setErr(t(res.error));
        setRows([]);
      }
    });
    return () => {
      alive = false;
    };
  }, [item.id, branchId, t]);

  const shown = useMemo(() => {
    const k = q.trim().toLowerCase();
    return (rows ?? []).filter((r) => !k || r.name.toLowerCase().includes(k));
  }, [rows, q]);
  const cur = rows?.find((r) => r.pupilId === sel) ?? null;

  async function give() {
    if (!cur || cur.error || busy) return;
    setBusy(true);
    const res = await gamApi<{ order: { itemName: string }; wished: boolean; levelUp: { name: string } | null; badges: { name: string }[] }>(
      "/api/gamification/shop/orders",
      { method: "POST", body: { pupilId: cur.pupilId, itemId: item.id } },
    );
    setBusy(false);
    if (!res.ok) {
      setErr(t(res.error));
      return;
    }
    onDone({ pupilName: cur.name, title: item.title, price: item.priceCoins, wished: res.wished, levelUp: res.levelUp, badges: res.badges ?? [] });
    modal.close();
  }

  return (
    <Modal onClose={onClose} controller={modal} bare locked size="lg" zIndex={130} panelClassName="overflow-y-auto">
      <div className="gm-page p-5">
        <h2 className="text-[17px] font-semibold">{t("Sovg'a berish")}</h2>
        <div className="mt-2 flex items-center gap-3">
          <Thumb imageUrl={item.imageUrl} emoji={item.emoji} size={44} />
          <div className="text-[13px]">
            <b>{t(item.title)}</b> · <span className="gm-coin">{item.priceCoins}</span>
            <div className="mt-0.5 flex flex-wrap gap-1">
              {kidsMaxGrade !== null && <AudienceChip a={item.audience} kidsMaxGrade={kidsMaxGrade} />}
              <Chip tone="m">{t(KIND_LABEL[item.kind])}</Chip>
            </div>
          </div>
        </div>
        <input
          aria-label={t("O'quvchi")}
          placeholder={t("Ism bo'yicha qidirish")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoComplete="off"
          className={`${inputCls} mt-4`}
        />
        <div ref={listRef} role="listbox" aria-label={t("O'quvchilar")} className="mt-2 max-h-[40vh] space-y-1.5 overflow-y-auto">
          {rows === null ? (
            <SpinnerBlock />
          ) : shown.length === 0 ? (
            <div className="px-3 py-3 text-[13px] text-muted-foreground">{t("Faol o'quvchi topilmadi")}</div>
          ) : (
            shown.map((r) => (
              <button
                key={r.pupilId}
                type="button"
                role="option"
                aria-selected={sel === r.pupilId}
                onClick={() => {
                  setSel(r.pupilId);
                  setErr("");
                }}
                className={`gm-tap flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left ${
                  sel === r.pupilId ? "border-primary ring-2 ring-primary/40" : "border-border"
                } ${r.error ? "opacity-60" : "hover:bg-secondary/50"}`}
              >
                <span className="min-w-0 flex-1">
                  <b className="text-[13.5px]">{r.name}</b>
                  {r.wished && (
                    <span className="ml-1.5">
                      <Chip tone="r">♥ {t("istagan")}</Chip>
                    </span>
                  )}
                  <span className="block text-[12px] text-muted-foreground">
                    {r.grade !== null ? `${t("{n}-sinf", { n: r.grade })} · ` : ""}
                    {r.branchName}
                    {r.error ? ` · ${t(r.error)}` : ""}
                  </span>
                </span>
                <span className="gm-coin">{r.balance}</span>
              </button>
            ))
          )}
        </div>
        <div className="mt-3">
          {!cur ? (
            <p className="text-[12.5px] text-muted-foreground">{t("Ro'yxatdan o'quvchini tanlang — sovg'a berish mumkin bo'lganlar yuqorida.")}</p>
          ) : cur.error ? (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[13px]">
              {cur.name}: {t(cur.error)}.
            </div>
          ) : (
            <div className="rounded-xl bg-secondary/60 px-3 py-2 text-[13px]">
              {t("{name} · balans {from} → {to}", { name: cur.name, from: cur.balance, to: cur.balance - item.priceCoins })}
              {cur.wished && <> · {t("♥ Istaklar ro'yxatida — berilgach ro'yxatdan olinadi")}</>}.
            </div>
          )}
          <FieldError text={err} />
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <button type="button" className={btnGhost} onClick={modal.close} disabled={busy}>
            {t("Bekor")}
          </button>
          <button type="button" className={btnPrimary} onClick={give} disabled={busy || !cur || !!cur.error}>
            {busy ? t("Saqlanmoqda…") : t("Berish")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Qaytarish ──────────────────────────────────────────────────────────

export interface ReturnTarget {
  id: number;
  pupilName: string;
  itemName: string;
  priceCoins: number;
  givenDate: string;
  kind: ItemKind;
  branchName?: string;
}

export function ReturnModal({ order, onClose, onDone }: { order: ReturnTarget; onClose: () => void; onDone: () => void }) {
  const { t } = useT();
  const modal = useModalClose(onClose);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function go() {
    if (!note.trim()) {
      setErr(t("Izoh yozish majburiy"));
      return;
    }
    setBusy(true);
    const res = await gamApi<object>(`/api/gamification/shop/orders/${order.id}/return`, { method: "POST", body: { note: note.trim() } });
    setBusy(false);
    if (!res.ok) {
      setErr(t(res.error));
      return;
    }
    onDone();
    modal.close();
  }
  return (
    <Modal onClose={onClose} controller={modal} bare locked size="md" zIndex={130} panelClassName="overflow-y-auto">
      <div className="gm-page p-5">
        <h2 className="text-[17px] font-semibold">{t("Sovg'ani qaytarish")}</h2>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">
          {order.pupilName} · {t(order.itemName)} · {fmtDate(order.givenDate)}
        </p>
        <div className="mt-3 rounded-xl bg-secondary/60 px-3 py-2 text-[13px]">
          {t("+{n} tanga qaytadi", { n: order.priceCoins })}
          {order.kind === "item" && <> · {t("filial omboriga +1 qaytadi, byudjet sarfidan chiqariladi")}</>}
          {order.kind === "discount" && <> · {t("chegirma bekor qilinadi, Moliyada qo'llanmaydi")}</>}.
        </div>
        <div className="mt-4">
          <label htmlFor="retN" className="mb-1 block text-[12px] font-semibold text-muted-foreground">
            {t("Izoh (majburiy)")}
          </label>
          <textarea
            id="retN"
            rows={2}
            value={note}
            maxLength={500}
            placeholder={t("Masalan: boshqa o'quvchiga berilib qo'yildi")}
            onChange={(e) => {
              setNote(e.target.value);
              setErr("");
            }}
            className={`${inputCls} h-auto py-2`}
          />
          <FieldError text={err} />
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <button type="button" className={btnGhost} onClick={modal.close} disabled={busy}>
            {t("Bekor")}
          </button>
          <button type="button" className={btnDanger} onClick={go} disabled={busy}>
            {busy ? t("Saqlanmoqda…") : t("Qaytarish")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Katalog: sovg'a qo'shish / tahrirlash (faqat direktor) ─────────────

/** Rasmni uzun tomoni 480 px gacha kichraytiradi (TZ 4.13.1) va JPEG qiladi. */
async function shrink(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = rej;
      im.src = url;
    });
    const k = Math.min(1, 480 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * k);
    c.height = Math.round(img.height * k);
    const x = c.getContext("2d")!;
    x.fillStyle = "#fff";
    x.fillRect(0, 0, c.width, c.height);
    x.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise<Blob>((res) => c.toBlob((b) => res(b ?? file), "image/jpeg", 0.85));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function ProductModal({
  item,
  branches,
  kidsMaxGrade,
  onClose,
  onSaved,
  onDelete,
}: {
  item: ShopItemView | null;
  branches: { id: number; name: string }[];
  kidsMaxGrade: number;
  onClose: () => void;
  onSaved: (msg: string) => void;
  onDelete?: (item: ShopItemView) => void;
}) {
  const { t } = useT();
  const modal = useModalClose(onClose);
  const [name, setName] = useState(item?.name ?? "");
  const [emoji, setEmoji] = useState(item?.emoji ?? "🎁");
  const [imageUrl, setImageUrl] = useState<string | null>(item?.imageUrl ?? null);
  const [price, setPrice] = useState(item ? String(item.priceCoins) : "");
  const [audience, setAudience] = useState<Audience>(item?.audience ?? "all");
  const [kind, setKind] = useState<"item" | "service">(item?.kind === "service" ? "service" : "item");
  const [cost, setCost] = useState(item?.costPriceSom != null ? String(item.costPriceSom) : "");
  const [stock, setStock] = useState<Record<string, string>>(() =>
    Object.fromEntries(branches.map((b) => [String(b.id), String(item?.stockAll?.[String(b.id)] ?? 0)])),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function pick(f: File | undefined) {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setErrors((e) => ({ ...e, image: t("Faqat rasm fayli") }));
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setErrors((e) => ({ ...e, image: t("Rasm 5 MB dan katta") }));
      return;
    }
    setUploading(true);
    const blob = await shrink(f).catch(() => f);
    const fd = new FormData();
    fd.append("file", new File([blob], "gift.jpg", { type: "image/jpeg" }));
    const res = await fetch("/api/gamification/shop/image", { method: "POST", body: fd })
      .then((r) => r.json())
      .catch(() => null);
    setUploading(false);
    if (!res?.ok) {
      setErrors((e) => ({ ...e, image: t(res?.error || "Rasmni yuklab bo'lmadi") }));
      return;
    }
    setImageUrl(String(res.url));
    setErrors((e) => ({ ...e, image: "" }));
  }

  async function save() {
    const errs: Record<string, string> = {};
    const n = name.trim().replace(/\s+/g, " ");
    if (!n) errs.name = t("Nomini yozing");
    if (intIn(price, 1, 100_000) === null) errs.price = t("Narx 1–100 000 tanga oralig'ida butun son bo'lsin");
    if (kind === "item" && intIn(cost || "0", 0, 100_000_000) === null) errs.cost = t("Tannarx 0 yoki musbat butun son bo'lsin (so'm)");
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    const body = { name: n, emoji, imageUrl, priceCoins: price, audience, kind, costPriceSom: cost || "0", stock };
    const res = item
      ? await gamApi<{ removedWishes: number }>(`/api/gamification/shop/items/${item.id}`, { method: "PUT", body })
      : await gamApi<{ removedWishes: number }>("/api/gamification/shop/items", { method: "POST", body });
    setBusy(false);
    if (!res.ok) {
      setErrors({ server: t(res.error) });
      return;
    }
    const base = item ? t("Saqlandi") : t("Sovg'a qo'shildi");
    onSaved(res.removedWishes ? `${base} · ${t("toifa mos kelmagani uchun {n} ta istak olib tashlandi", { n: res.removedWishes })}` : base);
    modal.close();
  }

  return (
    <Modal onClose={onClose} controller={modal} bare locked size="lg" zIndex={130} panelClassName="overflow-y-auto">
      <div className="gm-page p-5">
        <h2 className="text-[17px] font-semibold">{item ? t("Sovg'ani tahrirlash") : t("Yangi sovg'a")}</h2>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">{t("Do'konda o'quvchilar tangaga almashtiradigan buyum yoki xizmat.")}</p>
        <div className="mt-4 space-y-3.5">
          <div>
            <span className="mb-1 block text-[12px] font-semibold text-muted-foreground">{t("Rasm")}</span>
            <div className="flex flex-wrap items-center gap-3">
              <Thumb imageUrl={imageUrl} emoji={emoji} size={64} />
              <label className={`${btnSm} cursor-pointer`}>
                {uploading ? t("Yuklanmoqda…") : t("Rasm tanlash")}
                <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
              </label>
              <button type="button" className={btnSm} disabled={!imageUrl} onClick={() => setImageUrl(null)}>
                {t("Rasmni olib tashlash")}
              </button>
              <label className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                {t("Belgi")}
                <input aria-label={t("Belgi")} value={emoji} maxLength={4} onChange={(e) => setEmoji(e.target.value)} className="h-9 w-14 rounded-lg border border-border bg-card text-center" />
              </label>
            </div>
            <p className="mt-1 text-[12px] text-muted-foreground">{t("JPG/PNG, 5 MB gacha. Rasm bo'lmasa belgi ko'rsatiladi.")}</p>
            <FieldError text={errors.image ?? ""} />
          </div>
          <div>
            <label htmlFor="pN" className="mb-1 block text-[12px] font-semibold text-muted-foreground">
              {t("Nomi")} *
            </label>
            <input id="pN" value={name} maxLength={60} placeholder={t("Masalan: Akademiya ruchkasi")} onChange={(e) => setName(e.target.value)} className={inputCls} />
            <FieldError text={errors.name ?? ""} />
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div>
              <label htmlFor="pP" className="mb-1 block text-[12px] font-semibold text-muted-foreground">
                {t("Narx (tanga)")} *
              </label>
              <input id="pP" type="number" inputMode="numeric" min={1} step={1} value={price} onChange={(e) => setPrice(e.target.value)} className={inputCls} />
              <FieldError text={errors.price ?? ""} />
            </div>
            <div>
              <span className="mb-1 block text-[12px] font-semibold text-muted-foreground">{t("Kimlar uchun")}</span>
              <Select
                value={audience}
                onChange={(v) => setAudience(v as Audience)}
                options={[
                  { value: "all", label: t("Hammaga") },
                  { value: "kids", label: t("Kichiklar (1–{n}-sinf)", { n: kidsMaxGrade }) },
                  { value: "older", label: t("Kattalar") },
                ]}
                size="md"
              />
            </div>
          </div>
          <div>
            <span className="mb-1 block text-[12px] font-semibold text-muted-foreground">{t("Turi")}</span>
            <Select
              value={kind}
              onChange={(v) => setKind(v as "item" | "service")}
              options={[
                { value: "item", label: t("Buyum — omborda sanaladi") },
                { value: "service", label: t("Xizmat — ombor kerak emas (mock test, poster…)") },
              ]}
              size="md"
            />
          </div>
          {kind === "item" && (
            <>
              <div>
                <label htmlFor="pC" className="mb-1 block text-[12px] font-semibold text-muted-foreground">
                  {t("Tannarx (so'm) — oylik sovg'a byudjetidan shu summa hisoblanadi")}
                </label>
                <input id="pC" type="number" inputMode="numeric" min={0} step={1} value={cost} onChange={(e) => setCost(e.target.value)} className={inputCls} />
                <FieldError text={errors.cost ?? ""} />
              </div>
              <div>
                <span className="mb-1 block text-[12px] font-semibold text-muted-foreground">{t("Ombordagi soni (filial bo'yicha)")}</span>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {branches.map((b) => (
                    <label key={b.id} className="text-[12px] text-muted-foreground">
                      {b.name}
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={1}
                        value={stock[String(b.id)] ?? "0"}
                        onChange={(e) => setStock((s) => ({ ...s, [String(b.id)]: e.target.value }))}
                        className={`${inputCls} mt-1`}
                      />
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
          <FieldError text={errors.server ?? ""} />
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          {item && onDelete && (
            <button type="button" className={`${btnGhost} mr-auto text-rose-600`} onClick={() => onDelete(item)} disabled={busy}>
              {t("O'chirish")}
            </button>
          )}
          <button type="button" className={btnGhost} onClick={modal.close} disabled={busy}>
            {t("Bekor")}
          </button>
          <button type="button" className={btnPrimary} onClick={save} disabled={busy || uploading}>
            {busy ? t("Saqlanmoqda…") : item ? t("Saqlash") : t("Qo'shish")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function DiscountModal({
  item,
  kidsMaxGrade,
  onClose,
  onSaved,
}: {
  item: ShopItemView;
  kidsMaxGrade: number;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const { t } = useT();
  const modal = useModalClose(onClose);
  const [price, setPrice] = useState(String(item.priceCoins));
  const [pct, setPct] = useState(String(item.discountPercent ?? 5));
  const [audience, setAudience] = useState<Audience>(item.audience);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    if (intIn(price, 1, 100_000) === null) return setErr(t("Narx 1–100 000 tanga oralig'ida butun son bo'lsin"));
    if (intIn(pct, 1, 5) === null) return setErr(t("Chegirma foizi 1 dan 5 gacha butun son bo'lsin (qaror: maksimum 5%)"));
    setBusy(true);
    const res = await gamApi<{ removedWishes: number }>(`/api/gamification/shop/items/${item.id}`, {
      method: "PUT",
      body: { priceCoins: price, discountPercent: pct, audience },
    });
    setBusy(false);
    if (!res.ok) return setErr(t(res.error));
    onSaved(res.removedWishes ? `${t("Saqlandi")} · ${t("toifa mos kelmagani uchun {n} ta istak olib tashlandi", { n: res.removedWishes })}` : t("Saqlandi"));
    modal.close();
  }
  return (
    <Modal onClose={onClose} controller={modal} bare locked size="md" zIndex={130} panelClassName="overflow-y-auto">
      <div className="gm-page p-5">
        <h2 className="text-[17px] font-semibold">🏷️ {t("To'lovga chegirma")}</h2>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">
          {t("Maxsus sovg'a — o'chirilmaydi. Chegirma bir o'quvchiga oyiga ko'pi bilan 5%, keyingi oy to'loviga qo'llanadi.")}
        </p>
        <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <div>
            <label htmlFor="dP" className="mb-1 block text-[12px] font-semibold text-muted-foreground">
              {t("Narx (tanga)")}
            </label>
            <input id="dP" type="number" inputMode="numeric" min={1} step={1} value={price} onChange={(e) => setPrice(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label htmlFor="dF" className="mb-1 block text-[12px] font-semibold text-muted-foreground">
              {t("Chegirma foizi (1–5)")}
            </label>
            <input id="dF" type="number" inputMode="numeric" min={1} max={5} step={1} value={pct} onChange={(e) => setPct(e.target.value)} className={inputCls} />
          </div>
        </div>
        <div className="mt-3">
          <span className="mb-1 block text-[12px] font-semibold text-muted-foreground">{t("Kimlar uchun")}</span>
          <Select
            value={audience}
            onChange={(v) => setAudience(v as Audience)}
            options={[
              { value: "all", label: t("Hammaga") },
              { value: "kids", label: t("Kichiklar (1–{n}-sinf)", { n: kidsMaxGrade }) },
              { value: "older", label: t("Kattalar") },
            ]}
            size="md"
          />
        </div>
        <FieldError text={err} />
        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <button type="button" className={btnGhost} onClick={modal.close} disabled={busy}>
            {t("Bekor")}
          </button>
          <button type="button" className={btnPrimary} onClick={save} disabled={busy}>
            {busy ? t("Saqlanmoqda…") : t("Saqlash")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function DeleteItemModal({ item, onClose, onDone }: { item: ShopItemView; onClose: () => void; onDone: (msg: string) => void }) {
  const { t } = useT();
  const modal = useModalClose(onClose);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    const res = await gamApi<{ removedWishes: number }>(`/api/gamification/shop/items/${item.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) return setErr(t(res.error));
    const base = t("«{name}» o'chirildi", { name: item.name });
    onDone(res.removedWishes ? `${base} · ${t("{n} ta istak olib tashlandi", { n: res.removedWishes })}` : base);
    modal.close();
  }
  return (
    <Modal onClose={onClose} controller={modal} bare locked size="md" zIndex={140} panelClassName="overflow-y-auto">
      <div className="gm-page p-5">
        <h2 className="text-[17px] font-semibold">{t("Sovg'ani o'chirish")}</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {t("«{name}» do'kondan olib tashlanadi. Berilganlar tarixi saqlanadi, istaklar ro'yxatidan olinadi.", { name: item.name })}
        </p>
        <FieldError text={err} />
        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <button type="button" className={btnGhost} onClick={modal.close} disabled={busy}>
            {t("Bekor")}
          </button>
          <button type="button" className={btnDanger} onClick={go} disabled={busy}>
            {busy ? t("Saqlanmoqda…") : t("O'chirish")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
